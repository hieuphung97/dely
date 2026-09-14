# One small task

You are running inside a disposable environment created for a single proof
cycle. Do exactly this task and nothing else. Do not install anything, do not
change any other file, and do not run the project's own tests.

## The task

In the project copy at `{{project_path}}`, create the file
`{{relative_path}}` whose entire content is exactly this marker, with no
trailing newline and no other text:

{{marker}}

## What happens next

An independent check runs outside this session. It reads that file and
compares its content with the marker above, byte for byte. Nothing else about
this session is measured: this is a test of the environment's plumbing, not of
your reasoning.

When the file exists with exactly that content, report that you are done.
