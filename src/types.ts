import { Kind, TypeNode } from 'graphql';

export function buildNamespaceFromPath(path: string): string {
  const unixify = require('unixify');
  return unixify(path || '')
    .replace(/src\/main\/.*?\//, '')
    .replace(/\//g, '.');
}

export function wrapTypeWithModifiers(baseType: string, typeNode: TypeNode, listType = 'Iterable'): string {
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    return wrapTypeWithModifiers(baseType, typeNode.type, listType);
  } else if (typeNode.kind === Kind.LIST_TYPE) {
    const innerType = wrapTypeWithModifiers(baseType, typeNode.type, listType);

    return `${listType}<${innerType}>`;
  } else {
    return baseType;
  }
}