using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;

class JavawWrapper {
    static int Main(string[] args) {
        string logPath = Path.Combine(Path.GetTempPath(), "javaw_wrapper_log.txt");
        try {
            File.AppendAllText(logPath, "=== START " + DateTime.Now + " ===\n");
            File.AppendAllText(logPath, "args count: " + args.Length + "\n");
            foreach (var a in args) File.AppendAllText(logPath, "  arg: " + a + "\n");

            string baseDir = AppContext.BaseDirectory;
            File.AppendAllText(logPath, "baseDir: " + baseDir + "\n");

            string origExe = Path.Combine(baseDir, "javaw_orig.exe");
            File.AppendAllText(logPath, "origExe: " + origExe + " exists: " + File.Exists(origExe) + "\n");

            if (!File.Exists(origExe)) {
                origExe = Path.Combine(baseDir, "javaw_real.exe");
            }

            var newArgs = new List<string>();
            foreach (var arg in args) {
                if (arg.StartsWith("@")) {
                    string filePath = arg.Substring(1);
                    File.AppendAllText(logPath, "processing @file: " + filePath + " exists: " + File.Exists(filePath) + "\n");
                    if (File.Exists(filePath)) {
                        string content = File.ReadAllText(filePath);
                        string[] lines = content.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
                        bool changed = false;
                        for (int i = 0; i < lines.Length; i++) {
                            if (lines[i].Trim() == "--userType" && i + 1 < lines.Length) {
                                File.AppendAllText(logPath, "  found userType line, next: '" + lines[i + 1] + "'\n");
                                if (lines[i + 1].Trim() == "legacy") {
                                    lines[i + 1] = lines[i + 1].Replace("legacy", "mojang");
                                    changed = true;
                                    File.AppendAllText(logPath, "  replaced legacy -> mojang\n");
                                }
                            }
                        }
                        if (changed) {
                            string newContent = string.Join(Environment.NewLine, lines);
                            string newFile = Path.GetTempFileName();
                            File.WriteAllText(newFile, newContent);
                            newArgs.Add("@" + newFile);
                            File.AppendAllText(logPath, "  wrote new args file: " + newFile + "\n");
                        } else {
                            newArgs.Add(arg);
                        }
                    } else {
                        newArgs.Add(arg);
                    }
                } else {
                    newArgs.Add(arg);
                }
            }

            for (int i = 0; i < newArgs.Count - 1; i++) {
                if (newArgs[i] == "--userType" && newArgs[i + 1] == "legacy") {
                    newArgs[i + 1] = "mojang";
                }
            }

            string argLine = BuildArgLine(newArgs);
            File.AppendAllText(logPath, "final argLine: " + argLine + "\n");

            var psi = new ProcessStartInfo {
                FileName = origExe,
                Arguments = argLine,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            var p = Process.Start(psi);
            File.AppendAllText(logPath, "started orig process, id: " + (p != null ? p.Id.ToString() : "NULL") + "\n");
            if (p != null) {
                p.WaitForExit();
                File.AppendAllText(logPath, "orig exited with code: " + p.ExitCode + "\n");
                return p.ExitCode;
            }
        } catch (Exception e) {
            File.AppendAllText(Path.Combine(Path.GetTempPath(), "javaw_wrapper_err.txt"), e.ToString() + "\n");
        }
        return -1;
    }

    static string BuildArgLine(List<string> args) {
        var sb = new System.Text.StringBuilder();
        for (int i = 0; i < args.Count; i++) {
            if (i > 0) sb.Append(" ");
            string a = args[i];
            if (a.StartsWith("@")) {
                sb.Append(a);
            } else if (a.Contains(" ") || a.Contains("\t")) {
                sb.Append("\"").Append(a.Replace("\"", "\\\"")).Append("\"");
            } else {
                sb.Append(a);
            }
        }
        return sb.ToString();
    }
}
