import fs from "fs/promises";
import {
  statSync,
  createReadStream,
  createWriteStream,
} from "node:fs";
import path from "path";
import os from "os";
import { createHash } from "node:crypto";
import { createBrotliCompress, createBrotliDecompress } from "zlib";
import { pipeline } from "stream/promises";

// Get Username
const arg = process.argv.slice(2).find((arg) => arg.startsWith("--username"));
const username = arg ? arg.split("=")[1] : "Guest";

// Display welcome message
console.log(`Welcome to the File Manager, ${username}!`);

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log(`\nThank you for using File Manager, ${username}, goodbye!`);
  process.exit();
});

// Initial working directory
let currentDirectory = os.homedir();

// Display current directory
const pcd = () => console.log(`You are currently in ${currentDirectory}`);
pcd();

// List of commands
const commands = {
  up: () => {
    const parentDirectory = path.resolve(currentDirectory, "..");
    //   parentDirectory !== path.parse(parentDirectory).root)
    if (parentDirectory !== currentDirectory) {
      currentDirectory = parentDirectory;
    }
  },
  cd: async (directory) => {
    try {
      const newDirectory = path.resolve(currentDirectory, directory);
      const stats = await fs.stat(newDirectory);
      if (stats.isDirectory()) {
        currentDirectory = newDirectory;
      } else {
        throw Error;
      }
    } catch (err) {
      console.log("Operation failed");
    }
  },
  ls: async (filePath) => {
    try {
      const files = await fs.readdir(
        path.join(currentDirectory, filePath ?? "")
      );

      const dfolders = [];
      const dfiles = [];

      for (const file of files) {
        if (
          statSync(
            path.join(currentDirectory, filePath ?? "", file)
          ).isDirectory()
        ) {
          dfolders.push({ Name: file, Type: "directory" });
        } else {
          dfiles.push({ Name: file, Type: "file" });
        }
      }
      dfolders.sort((a, b) => a.Name - b.Name);
      dfiles.sort((a, b) => a.Name - b.Name);
      const result = [...dfolders, ...dfiles];

      if (result.length > 0) {
        console.table(result);
      } else {
        console.log("Empty directory");
      }
    } catch (error) {
      console.log("Operation failed");
    }
  },
  cat: async (filePath) => {
    try {
      const readStream = createReadStream(
        path.join(currentDirectory, filePath)
      );

      for await (const chunk of readStream) {
        console.log("\n" + chunk.toString() + "\n");
      }
    } catch (err) {
      console.error("Operation failed");
    }
  },
  add: async (fileName) => {
    try {
      const fd = await fs.open(path.join(currentDirectory, fileName), "wx");
      await fd.close();
    } catch (err) {
      console.log("Operation failed");
    }
  },
  rn: async (oldPath, newName) => {
    try {
      const oldDest = path.join(currentDirectory, oldPath);
      const newDest = path.join(currentDirectory, newName);
      await fs.rename(oldDest, newDest);
    } catch (err) {
      console.log("Operation failed");
    }
  },
  cp: async (source, destination) => {
    try {
      const sourcePath = path.join(currentDirectory, source);
      let destinationPath = path.join(currentDirectory, destination);

      // Stop operation if source is a folder or destination is file
      if (
        statSync(sourcePath).isDirectory() ||
        !statSync(destinationPath).isDirectory()
      ) {
        throw Error;
      }

      destinationPath = path.join(destinationPath, path.basename(source));

      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(destinationPath);

      await pipeline(readStream, writeStream);
    } catch {
      console.log("Operation failed");
    }
  },
  mv: async (source, destination) => {
    try {
      const sourcePath = path.join(currentDirectory, source);
      let destinationPath = path.join(currentDirectory, destination);

      // Stop operation if source is a folder or destination is file
      if (
        statSync(sourcePath).isDirectory() ||
        !statSync(destinationPath).isDirectory()
      ) {
        throw Error;
      }

      destinationPath = path.join(destinationPath, path.basename(source));

      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(destinationPath);

      await pipeline(readStream, writeStream);
      await fs.unlink(sourcePath);
    } catch (err) {
      console.log("Operation failed");
    }
  },
  rm: async (filePath) => {
    try {
      await fs.unlink(path.join(currentDirectory, filePath));
    } catch (err) {
      console.log("Operation failed");
    }
  },
  os: (param) => {
    switch (param) {
      case "--EOL":
        console.log(JSON.stringify(os.EOL));
        break;
      case "--cpus":
        console.table(
          os
            .cpus()
            .map((cpu) => ({
              Model: cpu.model,
              Speed: (cpu.speed / 1000).toFixed(1) + " GHz",
            }))
        );
        break;
      case "--homedir":
        console.log(os.homedir());
        break;
      case "--username":
        console.log(os.userInfo().username);
        break;
      case "--architecture":
        console.log(os.arch());
        break;
      default:
        console.log("Invalid input");
    }
  },
  hash: async (filePath) => {
    try {
      const hash = createHash("sha256");
      const readStream = createReadStream(
        path.join(currentDirectory, filePath)
      );

      for await (const chunk of readStream) {
        hash.update(chunk);
      }
      console.log(hash.digest("hex"));
    } catch (err) {
      console.error("Operation failed");
    }
  },
  compress: async (filePath, destinationPath) => {
    try {
      const readStream = createReadStream(
        path.join(currentDirectory, filePath)
      );
      const writeStream = createWriteStream(
        path.join(currentDirectory, destinationPath)
      );
      const compressStream = createBrotliCompress();

      await pipeline(readStream, compressStream, writeStream);
    } catch (err) {
      console.log("Operation failed.");
    }
  },
  decompress: async (filePath, destinationPath) => {
    try {
      const readStream = createReadStream(
        path.join(currentDirectory, filePath)
      );
      const writeStream = createWriteStream(
        path.join(currentDirectory, destinationPath)
      );
      const decompressStream = createBrotliDecompress();

      await pipeline(readStream, decompressStream, writeStream);
    } catch (err) {
      console.log("Operation failed.");
    }
  },
};

// Process user input
const processUserInput = async (input) => {
  const [command, ...params] = input.split(" ");
  try {
    await commands[command](...params);
  } catch (err) {
    console.log("Invalid input");
  } finally {
    pcd();
  }
};

// Read user input from console
process.stdin.on("data", (data) => {
  const userInput = data.toString().trim();
  if (userInput === ".exit") {
    console.log(`Thank you for using File Manager, ${username}, goodbye!`);
    process.exit();
  } else {
    processUserInput(userInput);
  }
});

console.log('Please enter commands and press Enter. Type ".exit" to quit.');
