import { ParsedAuraMarkup } from '../parsers/aura/markup-parser';
import { ParsedVfPage } from '../parsers/vf/page-parser';

export interface ComplexityMetrics {
    // Counts
    lineCount: number;
    attributeCount: number;
    methodCount: number;
    handlerCount: number;
    dependencyCount: number;

    // Complexity indicators
    hasCustomCSS: boolean;
    hasUnboundExpressions: boolean; // {!v.val} vs {#v.val}
    hasJQuery: boolean;
    hasDomManipulation: boolean;
    hasAuraMethod: boolean;
    hasDynamicCreation: boolean; // $A.createComponent

    // Specific to VF
    hasRemoteActions?: boolean;
    hasStandardController?: boolean;
    hasExtensions?: boolean;
}

export class MetricExtractor {
    static extractAuraMetrics(markup: ParsedAuraMarkup, rawContent: string): ComplexityMetrics {
        return {
            lineCount: rawContent.split('\n').length,
            attributeCount: markup.attributes.length,
            methodCount: markup.methods.length,
            handlerCount: markup.handlers.length,
            dependencyCount: markup.dependencies.length,

            hasCustomCSS: false, // Need to check CSS file
            hasUnboundExpressions: markup.expressions.some(e => e.original.includes('!')),
            hasJQuery: rawContent.includes('jQuery') || rawContent.includes('$ '),
            hasDomManipulation: rawContent.includes('document.') || rawContent.includes('window.'),
            hasAuraMethod: markup.methods.length > 0,
            hasDynamicCreation: rawContent.includes('$A.createComponent'),
        };
    }

    static extractVfMetrics(page: ParsedVfPage, rawContent: string): ComplexityMetrics {
        return {
            lineCount: rawContent.split('\n').length,
            attributeCount: 0, // Not applicable directly
            methodCount: page.remoteActions.length + page.actionFunctions.length,
            handlerCount: 0, // Not applicable directly
            dependencyCount: page.components.length,

            hasCustomCSS: page.includedStyles.length > 0 || rawContent.includes('<style>'),
            hasUnboundExpressions: false, // VF expressions are different
            hasJQuery: rawContent.includes('jQuery') || rawContent.includes('$ '),
            hasDomManipulation: rawContent.includes('document.') || rawContent.includes('window.') || page.customJavaScript.length > 0,
            hasAuraMethod: false,
            hasDynamicCreation: false,

            hasRemoteActions: page.remoteActions.length > 0,
            hasStandardController: !!page.pageAttributes.standardController,
            hasExtensions: !!page.pageAttributes.extensions && page.pageAttributes.extensions.length > 0
        };
    }
}
