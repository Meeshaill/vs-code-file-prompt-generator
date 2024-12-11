import * as vscode from "vscode";
import * as path from "path";

interface FileItem {
    uri: vscode.Uri;
    selected: boolean;
    type: "file";
}

interface DirectoryItem {
    uri: vscode.Uri;
    selected: boolean;
    type: "directory";
    children: (FileItem | DirectoryItem)[];
}

type FileOrDirectoryItem = FileItem | DirectoryItem;

export class FileNode extends vscode.TreeItem {
    constructor(public readonly item: FileItem) {
        super(path.basename(item.uri.fsPath));
        this.contextValue = item.selected
            ? "fileItemSelected"
            : "fileItemUnselected";
        this.iconPath = new vscode.ThemeIcon(
            item.selected ? "check" : "circle",
        );
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
}

export class DirectoryNode extends vscode.TreeItem {
    constructor(public readonly item: DirectoryItem) {
        super(path.basename(item.uri.fsPath));
        this.contextValue = item.selected
        ? "fileItemSelected"
        : "fileItemUnselected";    
        this.iconPath = new vscode.ThemeIcon(
            item.selected ? "check" : "folder",
        );
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
}

export class FileDataProvider
    implements vscode.TreeDataProvider<FileNode | DirectoryNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<
        FileNode | DirectoryNode | undefined | void
    > = new vscode.EventEmitter<FileNode | DirectoryNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<
        FileNode | DirectoryNode | undefined | void
    > = this._onDidChangeTreeData.event;

    private root: DirectoryItem | null = null;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.refreshFiles();
    }

    refreshFiles() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            // Keine offenen Workspace-Ordner: kein Refresh durchführbar
            return;
        }
    
        vscode.workspace.findFiles('**/*', '**/node_modules/**').then(uris => {
            const savedSelections = this.context.workspaceState.get<string[]>('selectedFiles', []);
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const rootDir: DirectoryItem = {
                uri: workspaceFolders[0].uri,
                selected: false,
                type: 'directory',
                children: []
            };
    
            for (const uri of uris) {
                const relativePath = path.relative(workspaceRoot, uri.fsPath);
                const parts = relativePath.split(/[\\/]/);
                this.insertFileItem(rootDir, parts, uri, savedSelections.includes(uri.toString()));
            }
    
            this.root = rootDir;
            this._onDidChangeTreeData.fire();
        });
    }
    

    insertFileItem(
        currentDir: DirectoryItem,
        parts: string[],
        uri: vscode.Uri,
        isSelected: boolean,
    ) {
        if (parts.length === 1) {
            // Datei im aktuellen Verzeichnis einfügen
            currentDir.children.push({
                uri,
                selected: isSelected,
                type: "file",
            });
        } else {
            // Erstes Element ist ein Unterverzeichnis, dieses ggf. finden oder erstellen
            const dirName = parts[0];
            let subDir = currentDir.children.find((item) =>
                item.type === "directory" &&
                path.basename(item.uri.fsPath) === dirName
            ) as DirectoryItem;

            if (!subDir) {
                // Unterverzeichnis erstellen
                const newDirUri = vscode.Uri.joinPath(currentDir.uri, dirName);
                subDir = {
                    uri: newDirUri,
                    selected: false,
                    type: "directory",
                    children: [],
                };
                currentDir.children.push(subDir);
            }

            // Rufe rekursiv für den restlichen Pfad auf
            this.insertFileItem(subDir, parts.slice(1), uri, isSelected);
        }
    }

    getTreeItem(element: FileNode | DirectoryNode): vscode.TreeItem {
        return element;
    }

    getChildren(
        element?: FileNode | DirectoryNode,
    ): Thenable<(FileNode | DirectoryNode)[]> {
        if (!this.root) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Sort children at root level
            const sortedChildren = [...this.root.children].sort((a, b) => {
                const aName = path.basename(a.uri.fsPath).toLowerCase();
                const bName = path.basename(b.uri.fsPath).toLowerCase();
                return aName.localeCompare(bName);
            });
        
            return Promise.resolve(
                sortedChildren.map((item) => this.createTreeItem(item)),
            );
        } else {
            // Kinder des angeklickten Elements (Verzeichnis)
            if (element instanceof DirectoryNode) {
                const sortedChildren = [...element.item.children].sort((a, b) => {
                    const aName = path.basename(a.uri.fsPath).toLowerCase();
                    const bName = path.basename(b.uri.fsPath).toLowerCase();
                    return aName.localeCompare(bName);
                });
        
                return Promise.resolve(
                    sortedChildren.map((item) => this.createTreeItem(item)),
                );
            } else {
                // Dateien haben keine Kinder
                return Promise.resolve([]);
            }
        }
        
    }

    createTreeItem(item: FileOrDirectoryItem): FileNode | DirectoryNode {
        if (item.type === "file") {
            return new FileNode(item);
        } else {
            return new DirectoryNode(item);
        }
    }

    toggleSelection(targetUri: vscode.Uri) {
        if (!this.root) return;
        this.toggleSelectionRecursive(this.root, targetUri);
        this.saveSelectionState();
        this._onDidChangeTreeData.fire();
    }

    toggleSelectionRecursive(
        dir: DirectoryItem,
        targetUri: vscode.Uri,
    ): boolean {
        // Versuche auf Verzeichnisebene
        if (dir.uri.toString() === targetUri.toString()) {
            const newSelection = !dir.selected;
            dir.selected = newSelection;
            this.setSelectionForChildren(dir, newSelection);
            return true;
        }

        // In Kindern nach Datei oder Ordner suchen
        for (const child of dir.children) {
            if (child.type === "file") {
                if (child.uri.toString() === targetUri.toString()) {
                    child.selected = !child.selected;
                    return true;
                }
            } else {
                // Ordner rekursiv durchsuchen
                if (this.toggleSelectionRecursive(child, targetUri)) {
                    return true;
                }
            }
        }
        return false;
    }

    setSelectionForChildren(dir: DirectoryItem, selected: boolean) {
        for (const child of dir.children) {
            if (child.type === "file") {
                child.selected = selected;
            } else {
                child.selected = selected;
                this.setSelectionForChildren(child, selected);
            }
        }
    }

    getSelectedFiles(): FileItem[] {
        if (!this.root) return [];
        const selectedFiles: FileItem[] = [];
        this.collectSelectedFiles(this.root, selectedFiles);
        return selectedFiles;
    }

    collectSelectedFiles(dir: DirectoryItem, selectedFiles: FileItem[]) {
        for (const child of dir.children) {
            if (child.type === "file" && child.selected) {
                selectedFiles.push(child);
            } else if (child.type === "directory") {
                // Wenn ein Verzeichnis selektiert ist, automatisch alle Dateien darunter nehmen
                // Alternativ könnte man auch nur gezielt ausgewählte Dateien nehmen.
                // Hier nehmen wir alle Dateien, die (implizit) selektiert wurden.
                if (child.selected) {
                    this.collectAllFiles(child, selectedFiles);
                } else {
                    this.collectSelectedFiles(child, selectedFiles);
                }
            }
        }
    }

    collectAllFiles(dir: DirectoryItem, selectedFiles: FileItem[]) {
        for (const child of dir.children) {
            if (child.type === "file") {
                selectedFiles.push(child);
            } else {
                this.collectAllFiles(child, selectedFiles);
            }
        }
    }

    getAllFiles(): FileItem[] {
        if (!this.root) return [];
        const allFiles: FileItem[] = [];
        this.collectAllFiles(this.root, allFiles);
        return allFiles;
    }

    saveSelectionState() {
        if (!this.root) return;
        const allSelectedUris: string[] = [];
        this.collectSelectedUris(this.root, allSelectedUris);
        this.context.workspaceState.update("selectedFiles", allSelectedUris);
    }

    collectSelectedUris(dir: DirectoryItem, allSelectedUris: string[]) {
        for (const child of dir.children) {
            if (child.type === "file" && child.selected) {
                allSelectedUris.push(child.uri.toString());
            } else if (child.type === "directory") {
                if (child.selected) {
                    // Alle Dateien dieses Verzeichnisses hinzufügen
                    const tempFiles: FileItem[] = [];
                    this.collectAllFiles(child, tempFiles);
                    allSelectedUris.push(
                        ...tempFiles.map((f) => f.uri.toString()),
                    );
                } else {
                    this.collectSelectedUris(child, allSelectedUris);
                }
            }
        }
    }
}
