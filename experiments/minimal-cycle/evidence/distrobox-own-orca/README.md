# A container with its own Orca, at the same path as the host's

A Distrobox container built from `docker.io/library/ubuntu:24.04`, given the
pinned `orca-ide_1.4.201_amd64.deb`, and probed from both sides with the same
command: `/opt/Orca/resources/bin/orca-ide`.

## What the two probes show

    field              host                        container
    orca_path          /opt/Orca/resources/bin/orca-ide   /opt/Orca/resources/bin/orca-ide
    orca_version       1.4.201                     1.4.201
    orca_fingerprint   7199608:1592:1789327972     100255748:1592:1789327972
    container_marker   (none)                      containerenv
    virt               none                        docker

The path is **identical**. The file is not: the inode differs, the size and
modification time match because it is the same package installed twice.

## Why this matters

The rule this replaced compared the path. On this data it called the
container's own installation the host's and refused to continue:

    comparing the path       -> host installation: True,  gate opens: False
    comparing what it resolves to -> host installation: False, gate opens: True

Both answers are produced by code that runs and returns a verdict. Only one of
them is right, and the wrong one refuses a correctly isolated environment. The
counterexample `the-same-path-is-not-the-same-file` holds that difference.

## What this does not show

An Orca *running* in the container, a worker dispatched through it, or a task
completed. The container was probed, not driven: starting the application in a
Distrobox container renders its window on the host's own desktop, which is this
backend's documented compromise and a deliberate act, not a side effect of a
test.
