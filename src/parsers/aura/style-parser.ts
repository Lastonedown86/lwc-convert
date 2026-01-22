/**
 * Parser for Aura CSS style files
 */

import postcss, { Root, Rule, Declaration, AtRule, Comment } from 'postcss';
import { logger } from '../../utils/logger';

export interface CssRule {
  selector: string;
  declarations: CssDeclaration[];
  isThisScoped: boolean;
}

export interface CssDeclaration {
  property: string;
  value: string;
  important: boolean;
}

export interface CssAtRule {
  name: string;
  params: string;
  rules: CssRule[];
}

export interface ParsedAuraStyle {
  rules: CssRule[];
  atRules: CssAtRule[];
  usesThisSelector: boolean;
  usesTokens: boolean;
  tokenReferences: string[];
  rawSource: string;
}

/**
 * Check if a selector uses THIS (Aura's scoping mechanism)
 */
function usesThisSelector(selector: string): boolean {
  return selector.includes('.THIS') || selector.startsWith('.THIS');
}

/**
 * Extract token references from CSS values
 * Aura tokens look like: token(namespace.tokenName) or t(tokenName)
 */
function extractTokenReferences(value: string): string[] {
  const tokens: string[] = [];
  const tokenRegex = /(?:token|t)\(([^)]+)\)/g;
  let match;

  while ((match = tokenRegex.exec(value)) !== null) {
    tokens.push(match[1].trim());
  }

  return tokens;
}

/**
 * Parse a CSS rule node
 */
function parseRule(rule: Rule): CssRule {
  const declarations: CssDeclaration[] = [];

  rule.walkDecls((decl: Declaration) => {
    declarations.push({
      property: decl.prop,
      value: decl.value,
      important: decl.important,
    });
  });

  return {
    selector: rule.selector,
    declarations,
    isThisScoped: usesThisSelector(rule.selector),
  };
}

/**
 * Parse Aura CSS styles
 */
export function parseAuraStyle(source: string): ParsedAuraStyle {
  const result: ParsedAuraStyle = {
    rules: [],
    atRules: [],
    usesThisSelector: false,
    usesTokens: false,
    tokenReferences: [],
    rawSource: source,
  };

  let root: Root;
  try {
    root = postcss.parse(source);
  } catch (error: any) {
    logger.warn(`Failed to parse CSS: ${error.message}`);
    return result;
  }

  // Process all nodes
  root.nodes?.forEach((node) => {
    if (node.type === 'rule') {
      const rule = parseRule(node as Rule);
      result.rules.push(rule);

      if (rule.isThisScoped) {
        result.usesThisSelector = true;
      }

      // Check for token usage in declarations
      for (const decl of rule.declarations) {
        const tokens = extractTokenReferences(decl.value);
        if (tokens.length > 0) {
          result.usesTokens = true;
          result.tokenReferences.push(...tokens);
        }
      }
    } else if (node.type === 'atrule') {
      const atRule = node as AtRule;
      const atRuleDef: CssAtRule = {
        name: atRule.name,
        params: atRule.params,
        rules: [],
      };

      // Process rules inside at-rules (like @media)
      atRule.walkRules((rule: Rule) => {
        const parsedRule = parseRule(rule);
        atRuleDef.rules.push(parsedRule);

        if (parsedRule.isThisScoped) {
          result.usesThisSelector = true;
        }

        for (const decl of parsedRule.declarations) {
          const tokens = extractTokenReferences(decl.value);
          if (tokens.length > 0) {
            result.usesTokens = true;
            result.tokenReferences.push(...tokens);
          }
        }
      });

      result.atRules.push(atRuleDef);
    }
  });

  // Deduplicate token references
  result.tokenReferences = [...new Set(result.tokenReferences)];

  logger.debug(`Parsed ${result.rules.length} CSS rules`);
  logger.debug(`Parsed ${result.atRules.length} at-rules`);
  if (result.usesThisSelector) {
    logger.debug('CSS uses .THIS selector (Aura scoping)');
  }
  if (result.usesTokens) {
    logger.debug(`CSS uses ${result.tokenReferences.length} design tokens`);
  }

  return result;
}

/**
 * Convert Aura CSS to LWC CSS
 * - Removes .THIS prefix (LWC auto-scopes)
 * - Converts token() to CSS custom properties where possible
 */
export function convertAuraStyleToLwc(parsed: ParsedAuraStyle): string {
  let css = parsed.rawSource;

  // Remove .THIS prefix from selectors
  // .THIS becomes :host
  // .THIS .child becomes .child
  // .THIS.modifier becomes :host(.modifier)
  css = css.replace(/\.THIS\s+/g, '');
  css = css.replace(/\.THIS\./g, ':host(.');
  css = css.replace(/\.THIS(?=[^a-zA-Z0-9_-]|$)/g, ':host');

  // Note: Token conversion is complex and may need manual attention
  // LWC uses CSS custom properties or SLDS design tokens
  if (parsed.usesTokens) {
    // Add a comment about tokens
    css =
      `/* TODO: Convert Aura tokens to CSS custom properties or SLDS tokens */\n/* Tokens found: ${parsed.tokenReferences.join(', ')} */\n\n` +
      css;
  }

  return css;
}
