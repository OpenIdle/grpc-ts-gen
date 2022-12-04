export interface INamingTransformer {
	ConvertInterfaceIdentifier(interfaceIdentifier: string): string;
	ConvertNamespace(namespace: string): string;
	ConvertFieldIdentifier(fieldIdentifier: string): string;
	ConvertEnumName(enumName: string): string;
}
