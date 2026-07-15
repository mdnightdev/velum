"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VelumShell = void 0;
var registry_ts_1 = require("./registry.ts");
var db_ts_1 = require("../server/db.ts");
var index_ts_1 = require("../server/db/index.ts");
var VelumShell = /** @class */ (function () {
    function VelumShell() {
        this.currentPath = '/';
        this.rl = null;
        this.isExecuting = false;
    }
    /**
     * Start the interactive readline shell loop
     */
    VelumShell.prototype.start = function (rlInterface) {
        this.rl = rlInterface;
        this.promptUser();
    };
    /**
     * Main prompt loop
     */
    VelumShell.prototype.promptUser = function () {
        var _this = this;
        if (!this.rl)
            return;
        // Refresh database caches in real-time before prompting command entry, silencing load progress logging
        var originalLog = console.log;
        var originalWarn = console.warn;
        var originalError = console.error;
        try {
            console.log = function () { };
            console.warn = function () { };
            console.error = function () { };
            (0, index_ts_1.loadDb)(true);
        }
        catch (err) {
            originalLog("DATABASE LOAD ERROR: ".concat(err.message || err));
        }
        finally {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
        }
        var pathColor = '\x1b[36m'; // Cyan
        var promptColor = '\x1b[32m\x1b[1m'; // Bold Green
        var arrowColor = '\x1b[33m\x1b[1m'; // Bold Yellow
        var resetColor = '\x1b[0m';
        var promptString = "".concat(promptColor, "velum-cli").concat(resetColor, " ").concat(pathColor).concat(this.currentPath).concat(resetColor).concat(arrowColor, ">").concat(resetColor, " ");
        this.rl.question(promptString, function (line) { return __awaiter(_this, void 0, void 0, function () {
            var trimmed, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        trimmed = line.trim();
                        if (!trimmed) {
                            return [2 /*return*/, this.promptUser()];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.handleInput(trimmed)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        console.log("ERROR: ".concat(err_1.message || err_1));
                        return [3 /*break*/, 4];
                    case 4:
                        if (!this.isExecuting) {
                            this.promptUser();
                        }
                        return [2 /*return*/];
                }
            });
        }); });
    };
    /**
     * Parses inputs, checks for navigation and help requests, then routes to dispatchers
     */
    VelumShell.prototype.handleInput = function (line) {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, verb, args, flags, resolved, cmdName, nsPath, meta;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parsed = this.parseCommandLine(line);
                        if (!parsed)
                            return [2 /*return*/];
                        verb = parsed.verb, args = parsed.args, flags = parsed.flags;
                        // Handle global shell navigation commands
                        if (this.handleGlobalShellCommands(verb, args, flags)) {
                            return [2 /*return*/];
                        }
                        resolved = this.resolveCommand(verb);
                        if (!resolved) {
                            console.log("Command not recognized in context \"".concat(this.currentPath, "\". Type \"help\" or \"ls\" to list valid entries."));
                            return [2 /*return*/];
                        }
                        cmdName = resolved.cmdName, nsPath = resolved.nsPath, meta = resolved.meta;
                        // Intercept contextual help flags: -h or --help
                        if (flags['h'] || flags['help']) {
                            this.printCommandHelp(nsPath, cmdName, meta);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.executeCommand(line, resolved, args, flags)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handles cd, ls, pwd, clear, exit, help, man
     */
    VelumShell.prototype.handleGlobalShellCommands = function (verb, args, flags) {
        var lowerVerb = verb.toLowerCase();
        if (lowerVerb === 'exit' || lowerVerb === 'quit') {
            console.log('Terminating administrative console session.');
            process.exit(0);
        }
        if (lowerVerb === 'clear' || lowerVerb === 'cls') {
            console.clear();
            return true;
        }
        if (lowerVerb === 'pwd') {
            console.log(this.currentPath);
            return true;
        }
        if (lowerVerb === 'help' || lowerVerb === '?') {
            this.printGlobalHelp();
            return true;
        }
        if (lowerVerb === 'cd') {
            var dest = args[0];
            if (!dest) {
                this.currentPath = '/';
                return true;
            }
            if (dest === '/') {
                this.currentPath = '/';
                return true;
            }
            if (dest === '..') {
                if (this.currentPath === '/')
                    return true;
                var segments = this.currentPath.split('/');
                segments.pop();
                this.currentPath = segments.join('/') || '/';
                return true;
            }
            if (!dest.startsWith('/')) {
                dest = (this.currentPath === '/' ? '' : this.currentPath) + '/' + dest;
            }
            if (registry_ts_1.COMMAND_REGISTRY[dest] || dest === '/') {
                this.currentPath = dest;
            }
            else {
                console.log("ERROR: Context path \"".concat(dest, "\" not recognized."));
            }
            return true;
        }
        if (lowerVerb === 'ls') {
            var isLong = flags['l'] === true;
            if (this.currentPath === '/') {
                var namespaces = ['users', 'lounges', 'support', 'db', 'sys', 'audit', 'fraud'];
                var descriptions_1 = {
                    users: 'User Lifecycle & Moderation',
                    lounges: 'Lounge & Sublounge Management',
                    support: 'Support Ticket Operations',
                    db: 'Database Maintenance',
                    sys: 'System Operations',
                    audit: 'Audit & Investigation',
                    fraud: 'Fraud & Asset Seizure'
                };
                if (isLong) {
                    console.log();
                    namespaces.forEach(function (ns) {
                        console.log("\u001B[90mdr-xr-xr-x\u001B[0m   \u001B[36m%-10s\u001B[0m   %s".replace(/%/g, '%-'), ns, descriptions_1[ns]);
                    });
                    console.log();
                }
                else {
                    console.log();
                    this.printGrid(namespaces);
                    console.log();
                }
            }
            else {
                var cmds = registry_ts_1.COMMAND_REGISTRY[this.currentPath];
                if (!cmds) {
                    console.log("ERROR: Context path \"".concat(this.currentPath, "\" not found."));
                    return true;
                }
                if (isLong) {
                    console.log();
                    for (var _i = 0, _a = Object.entries(cmds); _i < _a.length; _i++) {
                        var _b = _a[_i], name_1 = _b[0], meta = _b[1];
                        var perm = '\x1b[90m-r-x------\x1b[0m';
                        var riskColor = '\x1b[32m'; // LOW: Green
                        if (meta.risk === 'MEDIUM') {
                            perm = '\x1b[90m-r-xr-x---\x1b[0m';
                            riskColor = '\x1b[33m'; // MEDIUM: Yellow
                        }
                        else if (meta.risk === 'HIGH') {
                            perm = '\x1b[90m-r-xr-x---\x1b[0m';
                            riskColor = '\x1b[91m'; // HIGH: Light Red
                        }
                        else if (meta.risk === 'CRITICAL') {
                            perm = '\x1b[90m-rwxrwxrwx\x1b[0m';
                            riskColor = '\x1b[31m\x1b[1m'; // CRITICAL: Bold Red
                        }
                        var formattedRisk = "".concat(riskColor, "[").concat(meta.risk, "]\u001B[0m").padEnd(20);
                        console.log("".concat(perm, "   ").concat(formattedRisk, "   %-25s   %s").replace(/%/g, '%-'), name_1, meta.desc);
                    }
                    console.log();
                }
                else {
                    console.log();
                    this.printGrid(Object.keys(cmds));
                    console.log();
                }
            }
            return true;
        }
        if (lowerVerb === 'man') {
            var target = args[0];
            if (!target) {
                console.log('What manual page do you want?');
                return true;
            }
            var resolved = this.resolveCommand(target);
            if (!resolved) {
                console.log("No manual entry for ".concat(target));
                return true;
            }
            var cmdName = resolved.cmdName, nsPath = resolved.nsPath, meta = resolved.meta;
            var fullPath = (nsPath === '/' ? '' : nsPath) + '/' + cmdName;
            console.log("\n\u001B[33m\u001B[1mVELUM MANUAL PAGE: ".concat(cmdName.toUpperCase(), "\u001B[0m"));
            console.log('\x1b[90m' + '='.repeat(50) + '\x1b[0m');
            console.log("\u001B[32m\u001B[1mNAME\u001B[0m\n    ".concat(cmdName, " - ").concat(meta.desc, "\n"));
            console.log("\u001B[32m\u001B[1mPATH\u001B[0m\n    ".concat(fullPath, "\n"));
            var syntax = meta.args && meta.args.length > 0
                ? "".concat(cmdName, " ").concat(meta.args.join(' '))
                : cmdName;
            console.log("\u001B[32m\u001B[1mSYNOPSIS\u001B[0m\n    ".concat(syntax, "\n"));
            console.log("\u001B[32m\u001B[1mRISK LEVEL\u001B[0m\n    ".concat(meta.risk, "\n"));
            if (meta.flags && Object.keys(meta.flags).length > 0) {
                console.log('\x1b[32m\x1b[1mOPTIONS\x1b[0m');
                for (var _c = 0, _d = Object.entries(meta.flags); _c < _d.length; _c++) {
                    var _e = _d[_c], flag = _e[0], desc = _e[1];
                    console.log("    \u001B[36m".concat(flag.padEnd(25), "\u001B[0m ").concat(desc));
                }
                console.log();
            }
            console.log('\x1b[90m' + '='.repeat(50) + '\x1b[0m\n');
            return true;
        }
        return false;
    };
    /**
     * Resolves command paths in relative or absolute namespaces
     */
    VelumShell.prototype.resolveCommand = function (rawVerb) {
        var cmdName = '';
        var nsPath = this.currentPath;
        if (rawVerb.startsWith('/')) {
            var segments = rawVerb.split('/');
            cmdName = segments.pop() || '';
            nsPath = segments.join('/');
            if (nsPath === '')
                nsPath = '/';
        }
        else {
            cmdName = rawVerb;
        }
        var namespace = registry_ts_1.COMMAND_REGISTRY[nsPath];
        if (namespace && namespace[cmdName]) {
            return { cmdName: cmdName, nsPath: nsPath, meta: namespace[cmdName] };
        }
        return null;
    };
    /**
     * Formats and prints command-specific contextual help
     */
    VelumShell.prototype.printCommandHelp = function (nsPath, cmdName, meta) {
        var fullCommandPath = (nsPath === '/' ? '' : nsPath) + '/' + cmdName;
        console.log("\n=== COMMAND REFERENCE HELP ===");
        console.log("Path:        ".concat(fullCommandPath));
        console.log("Description: ".concat(meta.desc));
        console.log("Risk Level:  \u001B[1m".concat(meta.risk, "\u001B[0m"));
        if (meta.args && meta.args.length > 0) {
            console.log("Syntax:      ".concat(cmdName, " ").concat(meta.args.join(' ')));
        }
        else {
            console.log("Syntax:      ".concat(cmdName));
        }
        if (meta.flags && Object.keys(meta.flags).length > 0) {
            console.log("Flags:");
            for (var _i = 0, _a = Object.entries(meta.flags); _i < _a.length; _i++) {
                var _b = _a[_i], flag = _b[0], desc = _b[1];
                console.log("  ".concat(flag.padEnd(25), " - ").concat(desc));
            }
        }
        console.log("==============================\n");
    };
    /**
     * Prints the global catalog of namespaces and commands
     */
    VelumShell.prototype.printGlobalHelp = function () {
        console.log("\n  === VELUM SECURE ADMINISTRATIVE CONSOLE ===\n  \n  Global Shell Navigation:\n    cd <namespace>    - Navigate between namespaces\n    ls                - List items in current namespace (use \"ls -l\" for detailed mode)\n    pwd               - Print current administrative context path\n    clear             - Clear terminal screen\n    exit, quit        - Close CLI session\n    help, ?           - Show this navigation catalog\n    man <command>     - View the system manual entry for a command\n    \n  Namespaces:\n    /users            - User Lifecycle & Moderation\n    /lounges          - Lounge & Sublounge Management\n    /support          - Support Ticket Operations\n    /db               - Database Maintenance\n    /sys              - System Operations\n    /audit            - Audit & Investigation\n    /fraud            - Fraud & Asset Seizure\n    \n  Tip:\n    - You can run absolute commands from anywhere (e.g. /sys/status).\n    - Append \"-h\" or \"--help\" to any command for specific details (e.g. ban -h).\n");
    };
    /**
     * Command line parser supporting quotes and flag extractions
     */
    VelumShell.prototype.parseCommandLine = function (line) {
        var parts = [];
        var current = '';
        var inQuotes = false;
        var quoteChar = '';
        for (var i = 0; i < line.length; i++) {
            var char = line[i];
            if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (inQuotes && char === quoteChar) {
                    inQuotes = false;
                }
                else if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                }
                else {
                    current += char;
                }
            }
            else if (char === ' ' && !inQuotes) {
                if (current) {
                    parts.push(current);
                    current = '';
                }
            }
            else {
                current += char;
            }
        }
        if (current) {
            parts.push(current);
        }
        if (parts.length === 0)
            return null;
        var verb = parts[0];
        var args = [];
        var flags = {};
        for (var i = 1; i < parts.length; i++) {
            var part = parts[i];
            if (part.startsWith('--')) {
                var flagName = part.substring(2);
                if (i + 1 < parts.length && !parts[i + 1].startsWith('--')) {
                    flags[flagName] = parts[i + 1];
                    i++;
                }
                else {
                    flags[flagName] = true;
                }
            }
            else if (part.startsWith('-')) {
                var flagName = part.substring(1);
                if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
                    flags[flagName] = parts[i + 1];
                    i++;
                }
                else {
                    flags[flagName] = true;
                }
            }
            else {
                args.push(part);
            }
        }
        return { verb: verb, args: args, flags: flags };
    };
    /**
     * Executes resolved commands and enforces Risk-Tier confirmations locally
     */
    VelumShell.prototype.executeCommand = function (line, resolved, args, flags) {
        return __awaiter(this, void 0, void 0, function () {
            var cmdName, nsPath, meta, fullPath, commandToExec, firstSpace, verb, rest, prefix, targetToken_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cmdName = resolved.cmdName, nsPath = resolved.nsPath, meta = resolved.meta;
                        fullPath = (nsPath === '/' ? '' : nsPath) + '/' + cmdName;
                        commandToExec = line;
                        if (!line.trim().startsWith('/')) {
                            firstSpace = line.indexOf(' ');
                            verb = firstSpace === -1 ? line : line.substring(0, firstSpace);
                            rest = firstSpace === -1 ? '' : line.substring(firstSpace);
                            prefix = this.currentPath === '/' ? '' : this.currentPath;
                            commandToExec = "".concat(prefix, "/").concat(verb).concat(rest);
                        }
                        if (!(meta.risk === 'LOW')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.runDbCommand(commandToExec)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                    case 2:
                        // Enforce Risk Tier Verification
                        console.log("\n\u001B[1m\u001B[33m[SECURITY VERIFICATION REQUIRED - RISK LEVEL: ".concat(meta.risk, "]\u001B[0m"));
                        console.log("Action: \u001B[1m".concat(meta.desc, "\u001B[0m"));
                        this.isExecuting = true;
                        if (meta.risk === 'MEDIUM' || meta.risk === 'HIGH') {
                            this.rl.question("To confirm, type '\u001B[1myes\u001B[0m': ", function (answer) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(answer.trim().toLowerCase() === 'yes')) return [3 /*break*/, 2];
                                            return [4 /*yield*/, this.runDbCommand(commandToExec)];
                                        case 1:
                                            _a.sent();
                                            return [3 /*break*/, 3];
                                        case 2:
                                            console.log(" Operation cancelled.");
                                            _a.label = 3;
                                        case 3:
                                            this.isExecuting = false;
                                            this.promptUser();
                                            return [2 /*return*/];
                                    }
                                });
                            }); });
                        }
                        else if (meta.risk === 'CRITICAL') {
                            targetToken_1 = args[0] || 'CONFIRM';
                            console.log("This is an \u001B[31mIRREVERSIBLE\u001B[0m critical action.");
                            console.log("Please re-type the target identifier exactly to authorize: '\u001B[1m".concat(targetToken_1, "\u001B[0m'"));
                            this.rl.question("Enter target: ", function (ans1) {
                                if (ans1.trim() !== targetToken_1) {
                                    console.log(" Target mismatch. Operation aborted.");
                                    _this.isExecuting = false;
                                    _this.promptUser();
                                    return;
                                }
                                _this.rl.question("Enter mandatory administrative audit reason: ", function (ans2) { return __awaiter(_this, void 0, void 0, function () {
                                    var reason, commandWithReason;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                reason = ans2.trim();
                                                if (!reason || reason.length < 5) {
                                                    console.log(" Invalid audit reason. Minimum 5 characters required.");
                                                    this.isExecuting = false;
                                                    this.promptUser();
                                                    return [2 /*return*/];
                                                }
                                                commandWithReason = "".concat(commandToExec, " --reason \"").concat(reason.replace(/"/g, '\\"'), "\"");
                                                return [4 /*yield*/, this.runDbCommand(commandWithReason)];
                                            case 1:
                                                _a.sent();
                                                this.isExecuting = false;
                                                this.promptUser();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                            });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper that executes the finalized command string against the database engine
     */
    VelumShell.prototype.runDbCommand = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var result, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, db_ts_1.executeCliCommand)(command)];
                    case 1:
                        result = _a.sent();
                        console.log(result);
                        return [3 /*break*/, 3];
                    case 2:
                        err_2 = _a.sent();
                        console.log("DATABASE ERROR: ".concat(err_2.message || err_2));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper to format string arrays in neat rows and columns (grid format)
     */
    VelumShell.prototype.printGrid = function (items, columns, colWidth) {
        if (columns === void 0) { columns = 5; }
        if (colWidth === void 0) { colWidth = 22; }
        var row = [];
        for (var i = 0; i < items.length; i++) {
            row.push(items[i].padEnd(colWidth));
            if (row.length === columns || i === items.length - 1) {
                console.log(row.join(''));
                row = [];
            }
        }
    };
    return VelumShell;
}());
exports.VelumShell = VelumShell;
