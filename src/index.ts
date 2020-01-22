import { parse, GraphQLSchema, printSchema, visit } from 'graphql';
import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { RawConfig, EnumValuesMap } from '@graphql-codegen/visitor-plugin-common';
import { CSharpResolversVisitor } from './visitor';
import { buildNamespaceFromPath } from './csharp-common';
import { dirname, normalize } from 'path';

export interface CSharpResolversPluginRawConfig extends RawConfig {
  /**
   * @name namespace
   * @type string
   * @description Customize the CSharp namespace. The default namespace will be generated according to the output file path.
   *
   * @example
   * ```yml
   * generates:
   *   src/main/csharp/my-org/my-app/Resolvers.cs:
   *     plugins:
   *       - csharp
   *     config:
   *       package: custom.package.name
   * ```
   */
  namespace?: string;
  /**
   * @name enumValues
   * @type EnumValuesMap
   * @description Overrides the default value of enum values declared in your GraphQL schema.
   *
   * @example With Custom Values
   * ```yml
   *   config:
   *     enumValues:
   *       MyEnum:
   *         A: 'foo'
   * ```
   */
  enumValues?: EnumValuesMap;
  /**
   * @name className
   * @type string
   * @default Types
   * @description Allow you to customize the parent class name.
   *
   * @example
   * ```yml
   * generates:
   *   src/main/csharp/my-org/my-app/MyGeneratedTypes.cs:
   *     plugins:
   *       - csharp
   *     config:
   *       className: MyGeneratedTypes
   * ```
   */
  className?: string;
  /**
   * @name listType
   * @type string
   * @default Iterable
   * @description Allow you to customize the list type
   *
   * @example
   * ```yml
   * generates:
   *   src/main/csharp/my-org/my-app/Types.cs:
   *     plugins:
   *       - csharp
   *     config:
   *       listType: Map
   * ```
   */
  listType?: string;
}

export const plugin: PluginFunction<CSharpResolversPluginRawConfig> = async (schema: GraphQLSchema, documents: Types.DocumentFile[], config: CSharpResolversPluginRawConfig, { outputFile }): Promise<string> => {
  const relevantPath = dirname(normalize(outputFile));
  const defaultNamespace = buildNamespaceFromPath(relevantPath);
  const visitor = new CSharpResolversVisitor(config, schema, defaultNamespace);
  const printedSchema = printSchema(schema);
  const astNode = parse(printedSchema);
  const visitorResult = visit(astNode, { leave: visitor as any });
  const imports = visitor.getUsings();
  const packageName = visitor.getNamespace();
  const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n');
  const wrappedContent = visitor.wrapWithClass(blockContent);

  return [packageName, imports, wrappedContent].join('\n');
};