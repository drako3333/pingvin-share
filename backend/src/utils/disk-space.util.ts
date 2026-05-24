import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";

interface DiskSpaceResult {
  free: number;
  total: number;
}

const spaceCache: Record<string, { result: DiskSpaceResult; expiry: number; promise?: Promise<DiskSpaceResult> }> = {};

export function getDiskSpace(targetPath: string): Promise<DiskSpaceResult> {
  const absolutePath = path.resolve(targetPath);
  
  // Walk up directory tree to find the nearest existing directory
  let nearestPath = absolutePath;
  while (nearestPath && !fs.existsSync(nearestPath)) {
    const parent = path.dirname(nearestPath);
    if (parent === nearestPath) break;
    nearestPath = parent;
  }

  const now = Date.now();
  const cached = spaceCache[nearestPath];

  if (cached && cached.expiry > now) {
    return Promise.resolve(cached.result);
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = new Promise<DiskSpaceResult>((resolve) => {
    const fallback = { free: 500 * 1024 * 1024 * 1024, total: 1000 * 1024 * 1024 * 1024 };

    if (process.platform === "win32") {
      const driveLetter = nearestPath.substring(0, 1);
      const cmd = `powershell -NoProfile -Command "Get-Volume -DriveLetter '${driveLetter}' | Select-Object Size, SizeRemaining"`;
      exec(cmd, (err, stdout) => {
        if (err) {
          const cmdFallback = `powershell -NoProfile -Command "Get-PSDrive '${driveLetter}' | Select-Object Used, Free"`;
          exec(cmdFallback, (err2, stdout2) => {
            if (err2) {
              resolve(fallback);
            } else {
              const lines = stdout2.trim().split("\n").map(l => l.trim()).filter(Boolean);
              const valueLine = lines.find(line => /^\d+\s+\d+$/.test(line) || (line.split(/\s+/).length >= 2 && !isNaN(parseInt(line.split(/\s+/)[0]))));
              if (valueLine) {
                const parts = valueLine.split(/\s+/);
                const free = parseInt(parts[parts.length - 1], 10);
                const used = parseInt(parts[parts.length - 2], 10);
                resolve({ free, total: used + free });
              } else {
                resolve(fallback);
              }
            }
          });
        } else {
          const lines = stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
          const valueLine = lines.find(line => {
            const parts = line.split(/\s+/);
            return parts.length >= 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]));
          });
          if (valueLine) {
            const parts = valueLine.split(/\s+/);
            const total = parseInt(parts[0], 10);
            const free = parseInt(parts[1], 10);
            resolve({ free, total });
          } else {
            resolve(fallback);
          }
        }
      });
    } else {
      exec(`df -Pk "${nearestPath}"`, (err, stdout) => {
        if (err) {
          resolve(fallback);
        } else {
          const lines = stdout.trim().split("\n");
          if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/).filter(Boolean);
            if (parts.length >= 4) {
              const total = parseInt(parts[1], 10) * 1024;
              const free = parseInt(parts[3], 10) * 1024;
              resolve({ free, total });
            } else {
              resolve(fallback);
            }
          } else {
            resolve(fallback);
          }
        }
      });
    }
  });

  // Store active promise so concurrent calls reuse it
  spaceCache[nearestPath] = {
    result: { free: 0, total: 0 },
    expiry: 0,
    promise,
  };

  promise.then((res) => {
    spaceCache[nearestPath] = {
      result: res,
      expiry: Date.now() + 5000, // cache for 5 seconds
    };
  }).catch(() => {
    delete spaceCache[nearestPath];
  });

  return promise;
}
