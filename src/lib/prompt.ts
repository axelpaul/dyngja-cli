import { createInterface } from "node:readline/promises";

export async function ask(question: string, options: { mask?: boolean } = {}): Promise<string> {
	if (!options.mask || !process.stdin.isTTY || !process.stdin.setRawMode) {
		const readline = createInterface({ input: process.stdin, output: process.stdout });
		try {
			return (await readline.question(question)).trim();
		} finally {
			readline.close();
		}
	}

	return new Promise((resolve) => {
		let answer = "";
		const input = process.stdin;
		const onData = (chunk: Buffer | string) => {
			for (const character of chunk.toString()) {
				if (character === "\u0003") {
					cleanup();
					process.stdout.write("\n");
					process.exit(130);
				}
				if (character === "\r" || character === "\n") {
					cleanup();
					process.stdout.write("\n");
					resolve(answer);
					return;
				}
				if (character === "\u007f") {
					answer = answer.slice(0, -1);
					continue;
				}
				if (character >= " ") {
					answer += character;
					process.stdout.write("*");
				}
			}
		};
		const cleanup = () => {
			input.setRawMode?.(false);
			input.pause();
			input.off("data", onData);
		};
		process.stdout.write(question);
		input.setRawMode(true);
		input.resume();
		input.on("data", onData);
	});
}
