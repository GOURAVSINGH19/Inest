#!/usr/bin/env node

import { program } from 'commander';
import axios from 'axios';
import fs, { cp } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import FormData from 'form-data';
import { jwtDecode } from 'jwt-decode';

const CONFIG_PATH = path.join(os.homedir(), '.dropl-cli-config.json');

// Helper to save/load token
function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
}
function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return {};
}


function getUserIdFromToken(token) {
  try {
    const decoded = jwtDecode(token);
    return decoded.sub;
  } catch {
    return null;
  }
}

// Login with Clerk token
program
  .command('login')
  .description('Login to your dropl account with a Clerk session token')
  .option('--token <token>', 'Clerk session token')
  .action(async (options) => {
    if (!options.token) {
      console.log(chalk.red('Please provide a token: Inest login --token <token>'));
      return;
    }
    saveConfig({ token: options.token });
    console.log(chalk.green('Token saved! You are now logged in.'));
  });

// Upload command
program
  .command('upload <file...>')
  .description('Upload one or more files')
  .action(async (files) => {
    const { token } = loadConfig();
    if (!token) {
      console.log(chalk.red('Please login first using `Inest login --token <token>`.'));
      return;
    }
    const userId = getUserIdFromToken(token);
    if (!userId) {
      console.log(chalk.red('Could not extract userId from token.'));
      return;
    }
    for (const file of files) {
      try {
        const form = new FormData();
        form.append('files', fs.createReadStream(file));
        form.append('userId', userId);
        const res = await axios.post(
          'https://img-nest.vercel.app/api/files/upload',
          form,
          {
            headers: {
              ...form.getHeaders(),
              'Authorization': `Bearer ${token}`,
              Accept: 'application/json',
            }
          }
        );
        console.log(chalk.green(`Uploaded: ${file}`));
      } catch (err) {
        console.error(chalk.red(`Failed to upload ${file}:`), err.response?.data || err.message);
      }
    }
  });

// List files command
program
  .command('list')
  .description('List all your uploaded files')
  .action(async () => {
    const { token } = loadConfig();
    if (!token) {
      console.log(chalk.red('Please login first using `Inest login --token <token>`.'));
      return;
    }
    const userId = getUserIdFromToken(token);
    if (!userId) {
      console.log(chalk.red('Could not extract userId from token.'));
      return;
    }
    try {
      console.log(chalk.blue('Fetching your files...'));
      const res = await axios.get(
        `https://img-nest.vercel.app/api/files?userId=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      if (res.data && res.data.files && res.data.files.length) {
        res.data.files.forEach(file => {
          console.log(`${file.id}  ${file.name}  ${file.size} bytes`);
        });
      } else {
        console.log(chalk.yellow('No files found.'));
      }
    } catch (err) {
      console.error(chalk.red('Failed to list files:'), err.response?.data?.message || err.message);
    }
  });

program.parse(process.argv);
