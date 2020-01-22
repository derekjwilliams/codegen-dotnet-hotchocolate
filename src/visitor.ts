import { ParsedConfig, BaseVisitor, EnumValuesMap, indentMultiline, indent, buildScalars, getBaseTypeNode } from '@graphql-codegen/visitor-plugin-common';
import { CSharpResolversPluginRawConfig } from './index';
import {
  GraphQLSchema,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  TypeNode,
  Kind,
  NamedTypeNode,
  isScalarType,
  isInputObjectType,
  isEnumType,
} from 'graphql';
import { CSHARP_SCALARS, CSharpDeclarationBlock, wrapTypeWithModifiers } from './csharp-common';

export interface CSharpResolverParsedConfig extends ParsedConfig {
  namespace: string;
  className: string;
  listType: string;
  enumValues: EnumValuesMap;
}

export class CSharpResolversVisitor extends BaseVisitor<CSharpResolversPluginRawConfig, CSharpResolverParsedConfig> {
  private _addHashMapImport = false;
  private _addMapImport = false;
  private _addListImport = false;

  constructor(rawConfig: CSharpResolversPluginRawConfig, private _schema: GraphQLSchema, defaultNamespace: string) {
    super(rawConfig, {
      enumValues: rawConfig.enumValues || {},
      listType: rawConfig.listType || 'Iterable',
      className: rawConfig.className || 'Types',
      namespace: rawConfig.namespace || defaultNamespace,
      scalars: buildScalars(_schema, rawConfig.scalars, CSHARP_SCALARS),
    });
  }

  public getUsings(): string {
    return 'using ' + ['DotNetConf2019.GraphQL.Data',
    'HotChocolate',
    'HotChocolate.Resolvers',
    'HotChocolate.Types',
    'Markdig',
    'Microsoft.EntityFrameworkCore',
    'System.Collections.Generic',
    'System.Linq',
    'System.Threading.Tasks'].map(i => `using ${i};`).join('\n') + '\n';
  }

  public wrapWithClass(content: string): string {
    return new CSharpDeclarationBlock()
      .access('public')
      .asKind('class')
      .withName(this.config.className)
      .withBlock(indentMultiline(content)).string;
  }

  public getNamespace(): string {
    return `namespace ${this.config.namespace};\n`;
  }

  protected getEnumValue(enumName: string, enumOption: string): string {
    return '';
  }

  EnumValueDefinition(node: EnumValueDefinitionNode): (enumName: string) => string {
    return (enumName: string) => {
      return indent(`${this.convertName(node, { useTypesPrefix: false, transformUnderscore: true })}("${this.getEnumValue(enumName, node.name.value)}")`);
    };
  }

  EnumTypeDefinition(node: EnumTypeDefinitionNode): string {
    this._addHashMapImport = true;
    this._addMapImport = true;
    const enumName = this.convertName(node.name);
    const enumValues = node.values.map(v => v.toString())
                                  .map((v, i) => v.split('(')[0] + ' = ' + i).join(',\n');
    return new CSharpDeclarationBlock()
      .access('public')
      .asKind('enum')
      .withComment(node.description)
      .withName(enumName)
      .withBlock(indentMultiline(`${enumValues}`)).string;
  }

  protected resolveInputFieldType(typeNode: TypeNode): { baseType: string; typeName: string; isScalar: boolean; isArray: boolean } {
    const innerType = getBaseTypeNode(typeNode);
    const schemaType = this._schema.getType(innerType.name.value);
    const isArray = typeNode.kind === Kind.LIST_TYPE || (typeNode.kind === Kind.NON_NULL_TYPE && typeNode.type.kind === Kind.LIST_TYPE);
    let result: { baseType: string; typeName: string; isScalar: boolean; isArray: boolean } = null;

    if (isScalarType(schemaType)) {
      if (this.scalars[schemaType.name]) {
        result = {
          baseType: this.scalars[schemaType.name],
          typeName: this.scalars[schemaType.name],
          isScalar: true,
          isArray,
        };
      } else {
        result = { isArray, baseType: 'Object', typeName: 'Object', isScalar: true };
      }
    } else if (isInputObjectType(schemaType)) {
      result = {
        baseType: `${this.convertName(schemaType.name)}Input`,
        typeName: `${this.convertName(schemaType.name)}Input`,
        isScalar: false,
        isArray,
      };
    } else if (isEnumType(schemaType)) {
      result = { isArray, baseType: this.convertName(schemaType.name), typeName: this.convertName(schemaType.name), isScalar: true };
    } else {
      result = { isArray, baseType: 'Object', typeName: 'Object', isScalar: true };
    }

    if (result) {
      result.typeName = wrapTypeWithModifiers(result.typeName, typeNode, this.config.listType);
    }

    return result;
  }

  protected buildInputTransfomer(name: string, inputValueArray: ReadonlyArray<InputValueDefinitionNode>): string {
    this._addMapImport = true;

    const classMembers = inputValueArray
      .map(arg => {
        const typeToUse = this.resolveInputFieldType(arg.type);

        return indent(`private ${typeToUse.typeName} _${arg.name.value};`);
      })
      .join('\n');
    const ctorSet = inputValueArray
      .map(arg => {
        const typeToUse = this.resolveInputFieldType(arg.type);

        if (typeToUse.isArray && !typeToUse.isScalar) {
          this._addListImport = true;
          return indent(`this._${arg.name.value} = ((List<Map<String, Object>>) args.get("${arg.name.value}")).stream().map(${typeToUse.baseType}::new).collect(Collectors.toList());`, 3);
        } else if (typeToUse.isScalar) {
          return indent(`this._${arg.name.value} = (${typeToUse.typeName}) args.get("${arg.name.value}");`, 3);
        } else {
          return indent(`this._${arg.name.value} = new ${typeToUse.typeName}((Map<String, Object>) args.get("${arg.name.value}"));`, 3);
        }
      })
      .join('\n');
    const getters = inputValueArray
      .map(arg => {
        const typeToUse = this.resolveInputFieldType(arg.type);

        return indent(`public ${typeToUse.typeName} get${this.convertName(arg.name.value)}() { return this._${arg.name.value}; }`);
      })
      .join('\n');

    return `public static class ${name} {
${classMembers}

  public ${name}(Map<String, Object> args) {
    if (args != null) {
${ctorSet}
    }
  }

${getters}
}`;
  }

  FieldDefinition(node: FieldDefinitionNode): (typeName: string) => string {
    return (typeName: string) => {
      if (node.arguments.length > 0) {
        const transformerName = `${this.convertName(typeName, { useTypesPrefix: true })}${this.convertName(node.name.value, { useTypesPrefix: false })}Args`;

        return this.buildInputTransfomer(transformerName, node.arguments);
      }

      return null;
    };
  }

  InputObjectTypeDefinition(node: InputObjectTypeDefinitionNode): string {
    const name = `${this.convertName(node)}Input`;

    return this.buildInputTransfomer(name, node.fields);
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string {
    const fieldsArguments = node.fields.map(f => (f as any)(node.name.value)).filter(r => r);

    return fieldsArguments.join('\n');
  }
}