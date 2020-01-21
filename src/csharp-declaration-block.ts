import { transformComment, indentMultiline } from '@graphql-codegen/visitor-plugin-common';
import { Kind } from 'graphql';

const stripIndent = require('strip-indent');
class JavaDeclarationBlock {
    constructor() {
        this._name = null;
        this._extendStr = [];
        this._implementsStr = [];
        this._kind = null;
        this._access = 'public';
        this._final = false;
        this._static = false;
        this._block = null;
        this._comment = null;
        this._annotations = [];
        this._members = [];
        this._methods = [];
        this._nestedClasses = [];
    }
    nestedClass(nstCls) {
        this._nestedClasses.push(nstCls);
        return this;
    }
    access(access) {
        this._access = access;
        return this;
    }
    asKind(kind) {
        this._kind = kind;
        return this;
    }
    final() {
        this._final = true;
        return this;
    }
    static() {
        this._static = true;
        return this;
    }
    annotate(annotations) {
        this._annotations = annotations;
        return this;
    }
    withComment(comment) {
        if (comment) {
            this._comment = transformComment(comment, 0);
        }
        return this;
    }
    withBlock(block) {
        this._block = block;
        return this;
    }
    extends(extendStr) {
        this._extendStr = extendStr;
        return this;
    }
    implements(implementsStr) {
        this._implementsStr = implementsStr;
        return this;
    }
    withName(name) {
        this._name = typeof name === 'object' ? name.value : name;
        return this;
    }
    printMember(member) {
        const flags = member.flags || {};
        const pieces = [
            member.access,
            flags.static ? 'static' : null,
            flags.final ? 'final' : null,
            flags.transient ? 'transient' : null,
            flags.volatile ? 'volatile' : null,
            ...(member.annotations || []).map(annotation => `@${annotation}`),
            member.type,
            member.name,
        ].filter(f => f);
        return pieces.join(' ') + (member.value ? ` = ${member.value}` : '');
    }
    printMethod(method) {
        const pieces = [
            ...method.methodAnnotations.map(a => `@${a}\n`),
            method.access,
            method.flags.static ? 'static' : null,
            method.flags.final ? 'final' : null,
            method.flags.transient ? 'transient' : null,
            method.flags.volatile ? 'volatile' : null,
            ...(method.returnTypeAnnotations || []).map(annotation => `@${annotation}`),
            method.returnType,
            method.name,
        ].filter(f => f);
        const args = method.args.map(arg => this.printMember(arg)).join(', ');
        return `${pieces.join(' ')}(${args}) {
${indentMultiline(method.implementation)}
}`;
    }
    addClassMember(name, type, value, typeAnnotations = [], access = null, flags = {}) {
        this._members.push({
            name,
            type,
            value,
            annotations: typeAnnotations,
            access,
            flags: {
                final: false,
                transient: false,
                volatile: false,
                static: false,
                ...flags,
            },
        });
        return this;
    }
    addClassMethod(name, returnType, impl, args = [], returnTypeAnnotations = [], access = null, flags = {}, methodAnnotations = []) {
        this._methods.push({
            name,
            returnType,
            implementation: impl,
            args,
            returnTypeAnnotations,
            access,
            flags: {
                final: false,
                transient: false,
                volatile: false,
                static: false,
                ...flags,
            },
            methodAnnotations: methodAnnotations || [],
        });
        return this;
    }
    get string() {
        let result = '';
        if (this._kind) {
            let name = '';
            if (this._name) {
                name = this._name;
            }
            let extendStr = '';
            let implementsStr = '';
            let annotatesStr = '';
            const final = this._final ? ' final' : '';
            const isStatic = this._static ? ' static' : '';
            if (this._extendStr.length > 0) {
                extendStr = ` extends ${this._extendStr.join(', ')}`;
            }
            if (this._implementsStr.length > 0) {
                implementsStr = ` implements ${this._implementsStr.join(', ')}`;
            }
            if (this._annotations.length > 0) {
                annotatesStr = this._annotations.map(a => `@${a}`).join('\n') + '\n';
            }
            result += `${annotatesStr}${this._access}${isStatic}${final} ${this._kind} ${name}${extendStr}${implementsStr} `;
        }
        const members = this._members.length ? indentMultiline(stripIndent(this._members.map(member => this.printMember(member) + ';').join('\n'))) : null;
        const methods = this._methods.length ? indentMultiline(stripIndent(this._methods.map(method => this.printMethod(method)).join('\n\n'))) : null;
        const nestedClasses = this._nestedClasses.length ? this._nestedClasses.map(c => indentMultiline(c.string)).join('\n\n') : null;
        const before = '{';
        const after = '}';
        const block = [before, members, methods, nestedClasses, this._block, after].filter(f => f).join('\n');
        result += block;
        return (this._comment ? this._comment : '') + result + '\n';
    }
}

const JAVA_SCALARS = {
    ID: 'Object',
    String: 'String',
    Boolean: 'Boolean',
    Int: 'Integer',
    Float: 'Double',
};

function buildPackageNameFromPath(path) {
    const unixify = require('unixify');
    return unixify(path || '')
        .replace(/src\/main\/.*?\//, '')
        .replace(/\//g, '.');
}
function wrapTypeWithModifiers(baseType, typeNode, listType = 'Iterable') {
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
        return wrapTypeWithModifiers(baseType, typeNode.type, listType);
    }
    else if (typeNode.kind === Kind.LIST_TYPE) {
        const innerType = wrapTypeWithModifiers(baseType, typeNode.type, listType);
        return `${listType}<${innerType}>`;
    }
    else {
        return baseType;
    }
}

export { JAVA_SCALARS, JavaDeclarationBlock, buildPackageNameFromPath, wrapTypeWithModifiers };
