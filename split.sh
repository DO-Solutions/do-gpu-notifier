#!/bin/bash

input_file="frontend-code.js"  # your combined source file
current_file=""

while IFS= read -r line; do
  if [[ $line == '// frontend/'* ]]; then
    current_file="${line:3}"
    mkdir -p "$(dirname "$current_file")"
    > "$current_file"  # empty or create the file
  elif [[ -n $current_file ]]; then
    echo "$line" >> "$current_file"
  fi
done < "$input_file"