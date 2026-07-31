export function money(value: number | null | undefined, currency = "vISK"): string {
	if (value == null || !Number.isFinite(value)) return "—";
	return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

export function dateTime(value: string | null | undefined): string {
	if (!value) return "—";
	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) return value;
	const date = new Date(timestamp);
	const pad = (number: number) => String(number).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
