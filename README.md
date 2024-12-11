# VS File Prompt Generator

The **VS File Prompt Generator** (version 0.1.3) is an extension designed to help developers create structured prompts for AI-driven coding assistance by leveraging their project’s context. It allows you to select specific files and folders from your workspace, gather their contents, and generate a comprehensive `aiPrompt.json` file. This JSON includes a hierarchical representation of your project's structure, the selected files and directories, their content, and any diagnostic errors detected by Visual Studio Code.

## File Picker View
A dedicated "File Selector" view is added to the Explorer panel. This view displays your entire workspace structure as a collapsible tree. You can select/deselect individual files as well as entire directories. The entries are alphabetically sorted, making it easier to quickly find and select the files or folders you need.

![Screenshot of the file picker](https://raw.githubusercontent.com/Meeshaill/vs-code-file-prompt-generator/main/File%20Selector.png)

## Exported AI Prompt File
After selecting the desired files and/or directories, run the "Export Selected Files" command. This generates an `aiPrompt.json` in the workspace root, containing the structure, selected files, and diagnostic errors. The file is then automatically opened for review.

![Screenshot of the generated Prompt File](https://raw.githubusercontent.com/Meeshaill/vs-code-file-prompt-generator/main/AIPromptFile.png)

## Features

- **Hierarchical Selection:**  
  Browse your project's directories in a tree-like structure. Expand/collapse folders and toggle entire folders on or off at once.

- **Alphabetical Sorting:**  
  Files and directories are listed in alphabetical order, making navigation more intuitive.

- **Toggle File/Folder Selection:**  
  Toggle selection by clicking the inline button. Selected items are indicated with a checkmark and remembered across sessions.

- **Export to aiPrompt.json:**  
  Generate a JSON file (`aiPrompt.json`) containing:
  - **project-context:** A placeholder for your project's goals, technologies, and constraints.
  - **prompt:** A placeholder for your specific AI request.
  - **prompt-rules:** Default or previously specified rules for the AI prompt.
  - **structure:** A fully hierarchical representation of your project's directory tree.
  - **files:** A dictionary of selected file paths and their contents.
  - **errors:** A list of diagnostic information (file, line, message) provided by VS Code's language services.

- **Automatic .gitignore Update:**  
  Ensures `aiPrompt.json` is ignored by Git.

- **Immediate Review:**  
  Once generated, `aiPrompt.json` opens automatically in the editor, ready for you to refine and finalize your AI prompt.

## Example
{
  "project-context": "<User fills in>",
  "prompt": "<User fills in>",
  "prompt-rules": [
    "Always deliver the full scripts with your additions...",
    "Always use the provided files and data structure...",
    "Write your code with comments..."
  ],
  "structure": {
    "peopol": [
      {
        "dist": [
          "background.js",
          {
            "assets": [
              "main-kQJbKSsj.css"
            ]
          }
        ]
      }
    ]
  },
  "files": {
    "peopol/dist/background.js": "// file content here"
  },
  "errors": [
    {
      "file": "peopol/dist/background.js",
      "line": 10,
      "errorMessage": "Cannot find module 'x'"
    }
  ]
}

## Requirements
**VS Code Version:**
Visual Studio Code v1.95.0 or later is recommended.

**Workspace Folder:**
You must have a workspace folder open.

**Diagnostics:**
Error reporting depends on the language servers, linters, or other diagnostic providers you have set up. If no diagnostics are available, the errors array may be empty.

## Extension Settings
Currently, this extension does not add new user-facing settings. All functionality works out-of-the-box. Future versions may introduce customization options (e.g., ignoring certain directories, customizing output file name, etc.).

## Known Issues
**Diagnostics Dependence:**
If no language servers or linters are configured, the errors section may remain empty.

**Web Extension Support:**
This extension currently works only in local environments, not in web-based instances of VS Code.

## Change List
# Version 0.1.3

**Introduced hierarchical folder structure in the file selector.**
**Allowed toggling entire directories as well as individual files.**
**Added alphabetical sorting of files and directories.**
**Maintained existing prompt-rules when exporting aiPrompt.json if already present.**
**Stability and reliability improvements.**

# Version 0.1.2

**Introduced inline toggle buttons for easier selection.**
**Export now retains previously defined prompt-rules in aiPrompt.json.**
**Various bug fixes and performance improvements.**

# Version 1.0.0 (Initial Release)

**Added "File Selector" view and toggle selection feature for files.**
**Exporting selected files to aiPrompt.json with structure, files, and errors.**
**Automatically opens aiPrompt.json after export and updates .gitignore.**

(Note: The jump from version 1.0.0 to 0.x.x versions indicates a revision in versioning strategy.)