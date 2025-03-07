import * as fs from 'fs';
import AdmZip from 'adm-zip';
import axios from "axios";
import path from 'path';

type GitHubTag = {
  name: string;
  zipball_url: string;
  tarball_url: string;
  commit: {
    sha: string;
    url: string;
  };
  node_id: string;
}

const TAGS_URL = 'https://api.github.com/repos/tukui-org/ElvUI/tags';

const getLatestTag = async(): Promise<GitHubTag> => {
  try {
    const res = await axios.get<GitHubTag[]>(TAGS_URL)
    return res.data[0];
  } catch (err) {
    console.log('Error getting latest tag', err);
    throw err;
  }
}

const downloadTag = async (url: string, dest: string) => {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer'
    });
    
    fs.writeFileSync(dest, response.data);
  } catch (err) {
    console.error('Error downloading file:', err);
    throw err;
  }
}

const copyDir = (src: string, dest: string): void => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const extractZip = async (zipPath: string, targetDir: string): Promise<void> => {
  try {
    const zip = new AdmZip(zipPath);
    const extractDir = path.join(path.dirname(zipPath), 'extracted');
    const foldersToCopy = ['ElvUI', 'ElvUI_Libraries', 'ElvUI_Options'];
    
    zip.extractAllTo(extractDir, true);
    
    const entries = zip.getEntries();
    if (entries.length > 0) {
      const rootDirName = entries[0].entryName.split('/')[0];
      const rootDirPath = path.join(extractDir, rootDirName);
      
      if (fs.existsSync(rootDirPath) && fs.statSync(rootDirPath).isDirectory()) {
        for (const folder of foldersToCopy) {
          const folderPath = path.join(rootDirPath, folder);
          if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
            const targetFolderPath = path.join(targetDir, folder);
            copyDir(folderPath, targetFolderPath);
            console.log(`Copied ${folder} to ${targetFolderPath}`);
          } else {
            console.warn(`Folder not found: ${folder}`);
          }
        }
      }
      
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Error extracting zip:', error);
    throw error;
  }
}

const main = async (targetDir: string) => {
  const tempDir = path.join(__dirname, 'temp');
  const zipPath = path.join(tempDir, 'elvui.zip');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tag = await getLatestTag();
  console.log(`Latest version: ${tag.name}`)
  console.log('Downloading...');
  await downloadTag(tag.zipball_url, zipPath)
  console.log('Downloaded zip, extracting...')
  await extractZip(zipPath, targetDir);
}

if (require.main === module) {
  const targetDir = process.argv[2] || 'C:\\Program Files (x86)\\World of Warcraft\\_retail_\\Interface\\AddOns';
  main(targetDir)
    .then(() => console.log('Done!'))
    .catch(err => console.error('Error:', err));
}