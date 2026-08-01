const BOOLEAN_FLAGS = new Set([
	"help",
	"json",
	"pretty",
	"raw",
	"yes",
	"dry-run",
	"public",
	"version",
]);

export interface ParsedArgs {
	positionals: string[];
	flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
	const positionals: string[] = [];
	const flags: Record<string, string | boolean> = {};

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (!argument?.startsWith("--")) {
			if (argument !== undefined) positionals.push(argument);
			continue;
		}

		const withoutPrefix = argument.slice(2);
		const equals = withoutPrefix.indexOf("=");
		if (equals >= 0) {
			flags[withoutPrefix.slice(0, equals)] = withoutPrefix.slice(equals + 1);
			continue;
		}

		if (BOOLEAN_FLAGS.has(withoutPrefix)) {
			flags[withoutPrefix] = true;
			continue;
		}

		const next = argv[index + 1];
		if (next !== undefined && (!next.startsWith("--") || /^-?\d/.test(next))) {
			flags[withoutPrefix] = next;
			index += 1;
		} else {
			flags[withoutPrefix] = true;
		}
	}

	return { positionals, flags };
}

export function flagValue(args: ParsedArgs, name: string): string | undefined {
	const value = args.flags[name];
	return typeof value === "string" ? value : undefined;
}

export function hasFlag(args: ParsedArgs, name: string): boolean {
	return args.flags[name] !== undefined;
}
