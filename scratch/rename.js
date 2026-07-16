// rename-symbol.mjs
import { Project, SyntaxKind } from "ts-morph";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: node rename-symbol.mjs <definitionFile> <oldName> <newName>");
    process.exit(1);
  }

  const [definitionFilePath, oldName, newName] = args;

  // Initialize a project with your tsconfig.json (point it to the root)
  const project = new Project({
    tsConfigFilePath: "tsconfig.json",   // adjust if needed
    skipAddingFilesFromTsConfig: false,
  });

  // Make sure the definition file is loaded
  const sourceFile = project.getSourceFile(definitionFilePath);
  if (!sourceFile) {
    console.error(`File not found in project: ${definitionFilePath}`);
    process.exit(1);
  }

  // Find the symbol you want to rename (works for functions, classes, variables, etc.)
  const symbols = sourceFile.getSymbolsInScope(SyntaxKind.FunctionDeclaration); // adjust if not a function
  const symbol = symbols.find(s => s.getName() === oldName);
  if (!symbol) {
    console.error(`Symbol "${oldName}" not found in ${definitionFilePath}. Try expanding search to other declaration kinds.`);
    process.exit(1);
  }

  // Find all references across the whole project
  const references = symbol.findReferences();

  if (references.length === 0) {
    console.log(`No references found for "${oldName}".`);
    return;
  }

  // Rename each reference
  for (const referencedSymbol of references) {
    for (const reference of referencedSymbol.getReferences()) {
      const refNode = reference.getNode();
      // This will replace the identifier text while preserving everything else
      refNode.replaceWithText(newName);
      console.log(`Renamed in ${refNode.getSourceFile().getFilePath()}: line ${refNode.getStartLineNumber()}`);
    }
  }

  // Save all modified files
  await project.save();
  console.log(`Successfully renamed "${oldName}" → "${newName}" across the project.`);
}

main().catch(console.error);
