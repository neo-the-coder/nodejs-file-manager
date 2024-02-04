import fs from 'fs/promises';
import { statSync, createReadStream, createWriteStream } from 'node:fs';
import path from 'path';
import os from 'os';
import { createHash } from "node:crypto";
import { createBrotliCompress, createBrotliDecompress } from 'zlib';

// Command line arguments
const arg = process.argv.slice(2).find(arg => arg.startsWith('--username'));
const username = arg ? arg.split('=')[1]: 'Guest';

// Display welcome message
console.log(`Welcome to the File Manager, ${username}!`);

// TODO: prevent ^C printing
// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(`\nThank you for using File Manager, ${username}, goodbye!`);
  process.exit();
});

// Initial working directory
let currentDirectory = os.homedir();

// Display current directory
const pcd = () => console.log(`You are currently in ${currentDirectory}`);
pcd();

// List of operations
const operations = {
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
  ls: async () => {
    try {
        const files = await fs.readdir(currentDirectory);

        const dfolders = [];
        const dfiles = []

        for( const file of files) {
            if (statSync(path.join(currentDirectory, file)).isDirectory()) {
                dfolders.push({Name: file, Type: 'directory'});
            } else {
                dfiles.push({Name: file, Type: 'file'});
            }
        }
        dfolders.sort((a,b) => a.Name - b.Name);
        dfiles.sort((a,b) => a.Name - b.Name);
        console.table([...dfolders, ...dfiles]);
    } catch (error) {
        console.log("Operation failed");
    }
  },
  cat: (filePath) => {
    createReadStream(path.join(currentDirectory, filePath))
      .on("data", (chunk) => process.stdout.write(chunk))
      .on("end", () => console.log("\n"))
      .on("error", (err) => console.log("Operation failed.", err));
  },
  add: (fileName) => {
    fs.writeFile(path.join(currentDirectory, fileName), "", (err) => {
      if (err) {
        console.log("Operation failed.");
      }
    });
  },
  rn: (oldPath, newName) => {
    const newPath = path.join(currentDirectory, newName);
    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.log("Operation failed.");
      }
    });
  },
  cp: (source, destination) => {
    const sourcePath = path.join(currentDirectory, source);
    const destinationPath = path.join(currentDirectory, destination);

    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(destinationPath);

    readStream.pipe(writeStream);

    readStream.on("error", () => console.log("Operation failed."));
    writeStream.on("error", () => console.log("Operation failed."));
  },
  mv: (source, destination) => {
    const sourcePath = path.join(currentDirectory, source);
    const destinationPath = path.join(currentDirectory, destination);

    const readStream = createReadStream(sourcePath);
    const writeStream = createWriteStream(destinationPath);

    readStream.pipe(writeStream);

    readStream.on("error", () => console.log("Operation failed."));
    writeStream.on("error", () => console.log("Operation failed."));
    writeStream.on("finish", () => {
      fs.unlink(sourcePath, (err) => {
        if (err) {
          console.log("Operation failed.");
        }
      });
    });
  },
  rm: (filePath) => {
    fs.unlink(path.join(currentDirectory, filePath), (err) => {
      if (err) {
        console.log("Operation failed.");
      }
    });
  },
  os: (param) => {
    switch (param) {
      case "--EOL":
        console.log(JSON.stringify(os.EOL));
        break;
      case "--cpus":
        console.log(os.cpus())
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
        console.log("Invalid input.");
    }
  },
  hash: (filePath) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path.join(currentDirectory, filePath));

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () =>
      console.log(`Hash for ${filePath}:\n${hash.digest("hex")}`)
    );
    stream.on("error", () => console.log("Operation failed."));
  },
  compress: (filePath, destinationPath) => {
    const readStream = createReadStream(path.join(currentDirectory, filePath));
    const writeStream = createWriteStream(path.join(currentDirectory,destinationPath));
    const compressStream = createBrotliCompress();

    readStream.pipe(compressStream).pipe(writeStream);

    readStream.on("error", () => console.log("Operation failed."));
    writeStream.on("error", () => console.log("Operation failed."));
  },
  decompress: (filePath, destinationPath) => {
    const readStream = createReadStream(path.join(currentDirectory,filePath));
    const writeStream = createWriteStream(path.join(currentDirectory,destinationPath));
    const decompressStream = createBrotliDecompress();

    readStream.pipe(decompressStream).pipe(writeStream);

    readStream.on("error", () => console.log("Operation failed."));
    writeStream.on("error", () => console.log("Operation failed."));
  },
};

// Process user input
const processUserInput = async (input) => {
  const [operation, ...params] = input.split(" ");
  try {
    await operations[operation](...params);
  } catch (err) {
    console.log("Invalid input");
    console.log(err)
  } finally {
    pcd();
  }
  //   if (operations.hasOwnProperty(operation)) {
  //     operations[operation](...params);
  //     pcd();
  //   } else {
  //     console.log('Invalid input.');
  //   }
};

// Read user input from console
process.stdin.on('data', (data) => {
  const userInput = data.toString().trim();
  if (userInput === '.exit') {
    console.log(`Thank you for using File Manager, ${username}, goodbye!`);
    process.exit();
  } else {
    processUserInput(userInput);
  }
});

console.log('Please enter commands and press Enter. Type ".exit" to quit.');
