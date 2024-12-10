import * as vscode from "vscode";
import { FileDataProvider } from "./fileExplorer";
import * as path from "path";

let fileDataProvider: FileDataProvider;

export function activate(context: vscode.ExtensionContext) {
    fileDataProvider = new FileDataProvider(context);

    vscode.window.createTreeView("fileSelectorView", {
        treeDataProvider: fileDataProvider,
    });

    const toggleSelectionCommand = vscode.commands.registerCommand(
        "file-selector.toggleSelection",
        (node) => {
            if (node && node.file) {
                fileDataProvider.toggleSelection(node.file.uri);
            }
        },
    );

    const exportCommand = vscode.commands.registerCommand(
        "file-selector.exportSelected",
        async () => {
            await exportSelectedFiles();
        },
    );

    context.subscriptions.push(toggleSelectionCommand, exportCommand);
}

function findOrCreateSubdir(arr: any[], dirName: string): any[] {
    for (const item of arr) {
        if (typeof item === "object" && item.hasOwnProperty(dirName)) {
            return item[dirName];
        }
    }
    const newDir = { [dirName]: [] };
    arr.push(newDir);
    return newDir[dirName];
}

function insertFileIntoStructure(structure: any, parts: string[]) {
    if (parts.length === 0) return;

    const current = parts[0];

    if (parts.length === 1) {
        // Datei im Root-Verzeichnis
        const fileName = current;
        if (!structure["."]) {
            structure["."] = [];
        }
        structure["."].push(fileName);
        return;
    }

    // Verzeichnis
    const dirName = current;
    if (!structure[dirName]) {
        structure[dirName] = [];
    }

    const subParts = parts.slice(1);
    if (subParts.length === 1) {
        // Nächster Teil ist Datei
        const fileName = subParts[0];
        structure[dirName].push(fileName);
    } else {
        // Nächster Teil ist wieder ein Verzeichnis
        const nextDir = subParts[0];
        const remainder = subParts.slice(1);

        const subdirArray = findOrCreateSubdir(structure[dirName], nextDir);

        if (remainder.length === 1) {
            // Datei einfügen
            subdirArray.push(remainder[0]);
        } else {
            insertNestedDir(subdirArray, remainder);
        }
    }
}

function insertNestedDir(arr: any[], parts: string[]) {
    const current = parts[0];
    const remainder = parts.slice(1);

    if (remainder.length === 0) {
        // Datei
        arr.push(current);
        return;
    }

    // weiteres Verzeichnis
    const subdirArray = findOrCreateSubdir(arr, current);

    if (remainder.length === 1) {
        subdirArray.push(remainder[0]);
    } else {
        insertNestedDir(subdirArray, remainder);
    }
}

async function exportSelectedFiles() {
    const selected = fileDataProvider.getSelectedFiles();
    const allFiles = fileDataProvider.getAllFiles();

    if (
        !vscode.workspace.workspaceFolders ||
        vscode.workspace.workspaceFolders.length === 0
    ) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // Hierarchische Struktur aufbauen
    const structure: any = {};

    for (const f of allFiles) {
        const relPath = path.relative(workspaceFolder, f.uri.fsPath).replace(/\\/g, "/");
        const parts = relPath.split("/");
        
        if (parts.length === 1) {
            // Datei im Root
            if (!structure["."]) {
                structure["."] = [];
            }
            structure["."].push(parts[0]);
        } else {
            insertFileIntoStructure(structure, parts);
        }
    }

    const filesContent: { [key: string]: string } = {};
    for (const file of selected) {
        const relPath = path.relative(workspaceFolder, file.uri.fsPath).replace(/\\/g, "/");
        try {
            const fileContentBuffer = await vscode.workspace.fs.readFile(file.uri);
            filesContent[relPath] = fileContentBuffer.toString();
        } catch (err) {
            vscode.window.showWarningMessage(`Could not read file: ${relPath}. It may have been deleted or is inaccessible.`);
        }
    }

    const errors: { file: string; line: number; errorMessage: string }[] = [];
    const allDiagnostics = vscode.languages.getDiagnostics();
    for (const [diagUri, diagList] of allDiagnostics) {
        if (!diagList || diagList.length === 0) continue;

        const relPath = path.relative(workspaceFolder, diagUri.fsPath).replace(/\\/g, "/");

        for (const diag of diagList) {
            errors.push({
                file: relPath,
                line: diag.range.start.line,
                errorMessage: diag.message,
            });
        }
    }

    // Ensure any unsaved changes in aiPrompt.json are saved
    await vscode.workspace.saveAll();

    // Bestehende aiPrompt.json einlesen, um project-context und prompt zu erhalten
    const aiPromptJsonUri = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders[0].uri,
        "aiPrompt.json"
    );

    let existingPromptContext = "<User written description of his project, targets and the technology he is using>";
    let existingUserPrompt = "<User written specific task the AI should be working on>";

    try {
        const oldContent = (await vscode.workspace.fs.readFile(aiPromptJsonUri)).toString();
        const oldData = JSON.parse(oldContent);
        if (oldData["project-context"]) {
            existingPromptContext = oldData["project-context"];
        }
        if (oldData["prompt"]) {
            existingUserPrompt = oldData["prompt"];
        }
    } catch (err) {
        // aiPrompt.json noch nicht vorhanden oder nicht lesbar -> Standardwerte bleiben.
    }

    const data = {
        "project-context": existingPromptContext,
        "prompt": existingUserPrompt,
        "structure": structure,
        "files": filesContent,
        "errors": errors,
    };

    const jsonStr = JSON.stringify(data, null, 2);
    await vscode.workspace.fs.writeFile(aiPromptJsonUri, Buffer.from(jsonStr, "utf-8"));

    // .gitignore aktualisieren (nur für aiPrompt.json, da aiPrompt.txt nicht mehr erstellt wird)
    const gitignoreUri = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders[0].uri,
        ".gitignore",
    );
    try {
        const gitignoreContent =
            (await vscode.workspace.fs.readFile(gitignoreUri)).toString();
        if (!gitignoreContent.includes("aiPrompt.json")) {
            const newContent = gitignoreContent.trim() + "\naiPrompt.json\n";
            await vscode.workspace.fs.writeFile(
                gitignoreUri,
                Buffer.from(newContent, "utf-8"),
            );
        }
    } catch (err) {
        const newContent = "aiPrompt.json\n";
        await vscode.workspace.fs.writeFile(
            gitignoreUri,
            Buffer.from(newContent, "utf-8"),
        );
    }

    const doc = await vscode.workspace.openTextDocument(aiPromptJsonUri);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(
        "aiPrompt.json created/updated and opened."
    );
}
