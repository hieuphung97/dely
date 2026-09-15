"""The project copy is exported at a pinned revision and diffed on the host."""

import subprocess
import tempfile
import unittest
from pathlib import Path

from cycle_runner import project


def git(repo: Path, *arguments):
    subprocess.run(
        ["git", "-C", str(repo), *arguments],
        check=True,
        capture_output=True,
        text=True,
    )


def make_repo(root: Path) -> Path:
    repo = root / "under-test"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "cycle@example.invalid")
    git(repo, "config", "user.name", "cycle")
    (repo / "readme.md").write_text("first\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src" / "app.py").write_text("value = 1\n", encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "initial")
    return repo


class ExportTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.repo = make_repo(self.root)
        self.addCleanup(self._tmp.cleanup)

    def test_a_revision_resolves_to_a_commit_digest(self):
        resolved = project.resolve_revision(self.repo, "main")
        self.assertRegex(resolved, r"^[0-9a-f]{40}$")

    def test_an_unknown_revision_is_refused(self):
        with self.assertRaises(project.ProjectError):
            project.resolve_revision(self.repo, "no-such-ref")

    def test_the_export_carries_the_tracked_files(self):
        destination = self.root / "copy"
        project.export_revision(self.repo, "main", destination)
        self.assertEqual((destination / "readme.md").read_text(encoding="utf-8"), "first\n")
        self.assertTrue((destination / "src" / "app.py").is_file())

    def test_the_export_carries_no_repository_metadata(self):
        destination = self.root / "copy"
        project.export_revision(self.repo, "main", destination)
        self.assertFalse((destination / ".git").exists())

    def test_the_export_ignores_uncommitted_work(self):
        (self.repo / "scratch.txt").write_text("not committed\n", encoding="utf-8")
        destination = self.root / "copy"
        project.export_revision(self.repo, "main", destination)
        self.assertFalse((destination / "scratch.txt").exists())

    def test_exporting_into_an_occupied_directory_is_refused(self):
        destination = self.root / "copy"
        destination.mkdir()
        (destination / "leftover").write_text("x", encoding="utf-8")
        with self.assertRaises(project.ProjectError):
            project.export_revision(self.repo, "main", destination)

    def test_a_source_that_is_not_a_repository_is_refused(self):
        with self.assertRaises(project.ProjectError):
            project.resolve_revision(self.root, "main")


class DiffTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.baseline = self.root / "baseline"
        self.current = self.root / "current"
        for tree in (self.baseline, self.current):
            tree.mkdir()
            (tree / "readme.md").write_text("first\n", encoding="utf-8")
        self.addCleanup(self._tmp.cleanup)

    def test_identical_trees_produce_no_patch(self):
        self.assertEqual(project.unified_diff(self.baseline, self.current), "")

    def test_an_added_file_appears_as_an_addition(self):
        (self.current / "evidence.txt").write_text("dely-cycle-marker\n", encoding="utf-8")
        patch = project.unified_diff(self.baseline, self.current)
        self.assertIn("--- /dev/null", patch)
        self.assertIn("+++ b/evidence.txt", patch)
        self.assertIn("+dely-cycle-marker", patch)

    def test_a_removed_file_appears_as_a_removal(self):
        (self.current / "readme.md").unlink()
        patch = project.unified_diff(self.baseline, self.current)
        self.assertIn("--- a/readme.md", patch)
        self.assertIn("+++ /dev/null", patch)

    def test_a_modified_file_appears_as_a_hunk(self):
        (self.current / "readme.md").write_text("second\n", encoding="utf-8")
        patch = project.unified_diff(self.baseline, self.current)
        self.assertIn("-first", patch)
        self.assertIn("+second", patch)

    def test_a_changed_binary_file_is_named_without_its_content(self):
        (self.baseline / "blob.bin").write_bytes(b"\x00\x01\x02")
        (self.current / "blob.bin").write_bytes(b"\x00\x09\x02")
        patch = project.unified_diff(self.baseline, self.current)
        self.assertIn("Binary files a/blob.bin and b/blob.bin differ", patch)
        self.assertNotIn("\x09\x02", patch)

    def test_nested_paths_are_reported_with_forward_slashes(self):
        nested = self.current / "src"
        nested.mkdir()
        (nested / "new.py").write_text("value = 2\n", encoding="utf-8")
        patch = project.unified_diff(self.baseline, self.current)
        self.assertIn("+++ b/src/new.py", patch)

    def test_the_patch_is_redacted(self):
        secret = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"
        (self.current / "leak.txt").write_text(secret + "\n", encoding="utf-8")
        patch = project.unified_diff(self.baseline, self.current)
        self.assertNotIn(secret, patch)

    def test_a_missing_current_tree_reports_every_file_as_removed(self):
        patch = project.unified_diff(self.baseline, self.root / "absent")
        self.assertIn("--- a/readme.md", patch)


class DiffExclusionTest(unittest.TestCase):
    """Repository metadata is not what the task changed."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.baseline = self.root / "baseline"
        self.current = self.root / "current"
        for tree in (self.baseline, self.current):
            (tree / "src").mkdir(parents=True)
            (tree / "src" / "app.py").write_text("value = 1\n", encoding="utf-8")
        self.addCleanup(self._tmp.cleanup)

    def test_repository_metadata_is_left_out_of_the_patch(self):
        objects = self.current / ".git" / "objects"
        objects.mkdir(parents=True)
        (objects / "deadbeef").write_bytes(b"\x01\x02\x03")
        (self.current / ".git" / "HEAD").write_text("ref: refs/heads/main\n", encoding="utf-8")
        patch = project.unified_diff(self.baseline, self.current)
        self.assertEqual(patch, "")

    def test_what_the_task_changed_is_still_shown(self):
        (self.current / ".git").mkdir()
        (self.current / ".git" / "HEAD").write_text("ref: refs/heads/main\n", encoding="utf-8")
        (self.current / "evidence.txt").write_text("dely-cycle-marker\n", encoding="utf-8")
        patch = project.unified_diff(self.baseline, self.current)
        self.assertIn("+++ b/evidence.txt", patch)
        self.assertNotIn(".git", patch)


class InitialiseRepositoryTest(unittest.TestCase):
    """Orca registers a worktree for a repository, so the copy has to be one."""

    def test_the_commands_initialise_and_commit_the_copy(self):
        argv_list = project.initialise_repository_commands("/home/cycle/project")
        joined = [" ".join(argv) for argv in argv_list]
        self.assertTrue(any("init" in line for line in joined))
        self.assertTrue(any("add" in line for line in joined))
        self.assertTrue(any("commit" in line for line in joined))
        for argv in argv_list:
            self.assertIn("/home/cycle/project", argv)

    def test_an_identity_is_set_so_the_commit_does_not_need_one_configured(self):
        joined = " ".join(" ".join(argv) for argv in project.initialise_repository_commands("/p"))
        self.assertIn("user.email", joined)
        self.assertIn("user.name", joined)

    def test_the_commit_is_not_attributed_to_a_person(self):
        joined = " ".join(" ".join(argv) for argv in project.initialise_repository_commands("/p"))
        self.assertIn("dely-cycle", joined)
