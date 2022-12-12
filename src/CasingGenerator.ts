function Capitalize(str: string): string {
	if (str.length > 0) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	} else {
		return str;
	}
}

export function ToPascalCase(parts: string[]): string {
	return parts.map(x => Capitalize(x)).join("");
}

export function ToCamelCase(parts: string[]): string {
	if (parts.length == 0)
		return "";
	return parts[0] + parts.slice(1).map(x => Capitalize(x)).join("");
}

export function ToSnakeCase(parts: string[]): string {
	return parts.join("_");
}

export function ToScreamingSnakeCase(parts: string[]): string {
	return parts.map((x) => x.toUpperCase()).join("_");
}
