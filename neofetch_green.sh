#!/bin/bash

# ANSI green-on-black for WSL
echo -e "\033]0;Hacker Mode Activated\007"
echo -e "\033[0;32m"  # Set foreground to green

# Optional: clear screen
clear

# Run neofetch with green output
neofetch --colors 2 2 2 2 2 2

# Reset colors back to normal after
echo -e "\033[0m"
