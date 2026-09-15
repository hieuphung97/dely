# Builds the one tool image the machine backend runs.
#
# The source is the verified Ubuntu cloud image, booted by qemu with a
# cloud-init seed this template renders. Everything the provisioner installs is
# pinned and digest-checked. No host credential, token or key reaches the image:
# the only key it carries is the throwaway public half the build itself uses,
# and the provisioner removes it before shutdown.

packer {
  required_plugins {
    qemu = {
      version = "~> 1.1"
      source  = "github.com/hashicorp/qemu"
    }
  }
}

variable "base_image" {
  type        = string
  description = "Absolute path to the verified Ubuntu cloud image."
}

variable "base_image_sha256" {
  type        = string
  description = "The digest the base image is pinned to."
}

variable "output_directory" {
  type = string
}

variable "image_name" {
  type    = string
  default = "tool-image.qcow2"
}

variable "build_public_key" {
  type        = string
  description = "Throwaway public key the build uses to reach the guest."
}

variable "build_private_key_file" {
  type = string
}

variable "orca_url" {
  type = string
}

variable "orca_sha256" {
  type = string
}

variable "claude_code_version" {
  type = string
}

variable "guest_user" {
  type    = string
  default = "cycle"
}

variable "disk_size" {
  type    = string
  default = "24576M"
}

source "qemu" "tool_image" {
  iso_url          = var.base_image
  iso_checksum     = "sha256:${var.base_image_sha256}"
  disk_image       = true
  disk_size        = var.disk_size
  format           = "qcow2"
  accelerator      = "kvm"
  headless         = true
  net_device       = "virtio-net"
  disk_interface   = "virtio"
  machine_type     = "q35"
  memory           = 4096
  cpus             = 4
  output_directory = var.output_directory
  vm_name          = var.image_name

  cd_label = "cidata"
  cd_content = {
    "meta-data" = <<-EOM
      instance-id: dely-cycle-tool-image
      local-hostname: dely-cycle-tool-image
    EOM
    "user-data" = <<-EOU
      #cloud-config
      hostname: dely-cycle-tool-image
      users:
        - name: ${var.guest_user}
          shell: /bin/bash
          sudo: ALL=(ALL) NOPASSWD:ALL
          lock_passwd: true
          ssh_authorized_keys:
            - ${var.build_public_key}
      ssh_pwauth: false
    EOU
  }

  ssh_username         = var.guest_user
  ssh_private_key_file = var.build_private_key_file
  ssh_timeout          = "15m"
  shutdown_command     = "sudo shutdown -P now"
  shutdown_timeout     = "10m"
}

build {
  name    = "dely-cycle-tool-image"
  sources = ["source.qemu.tool_image"]

  provisioner "shell" {
    environment_vars = [
      "ORCA_URL=${var.orca_url}",
      "ORCA_SHA256=${var.orca_sha256}",
      "CLAUDE_CODE_VERSION=${var.claude_code_version}",
      "GUEST_USER=${var.guest_user}",
    ]
    script          = "provision.sh"
    execute_command = "chmod +x {{ .Path }}; env {{ .Vars }} {{ .Path }}"
  }

  post-processor "manifest" {
    output     = "${var.output_directory}/packer-manifest.json"
    strip_path = false
  }
}
