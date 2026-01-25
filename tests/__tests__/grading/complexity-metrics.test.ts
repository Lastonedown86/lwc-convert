import { MetricExtractor } from '../../../src/grading/complexity-metrics';
import { ParsedAuraMarkup } from '../../../src/parsers/aura/markup-parser';
import { ParsedVfPage } from '../../../src/parsers/vf/page-parser';

describe('MetricExtractor', () => {
    describe('extractAuraMetrics', () => {
        it('should extract metrics from Aura markup', () => {
            const markup: ParsedAuraMarkup = {
                componentName: 'Test',
                attributes: [{ name: 'attr1', type: 'String' }],
                handlers: [{ name: 'init', event: 'init', action: '{!c.init}' }],
                registeredEvents: [],
                methods: [],
                body: [],
                expressions: [{ original: '{!v.val}', type: 'attribute', reference: 'val' }],
                dependencies: ['c:child'],
                facets: new Map()
            };

            const rawContent = `
        <aura:component>
          <aura:attribute name="attr1" type="String"/>
          <aura:handler name="init" value="{!this}" action="{!c.init}"/>
          {!v.val}
          <c:child/>
        </aura:component>
      `;

            const metrics = MetricExtractor.extractAuraMetrics(markup, rawContent);

            expect(metrics.attributeCount).toBe(1);
            expect(metrics.handlerCount).toBe(1);
            expect(metrics.dependencyCount).toBe(1);
            expect(metrics.hasUnboundExpressions).toBe(true);
            expect(metrics.hasJQuery).toBe(false);
        });

        it('should detect jQuery and DOM manipulation', () => {
            const markup: ParsedAuraMarkup = {
                componentName: 'Test',
                attributes: [],
                handlers: [],
                registeredEvents: [],
                methods: [],
                body: [],
                expressions: [],
                dependencies: [],
                facets: new Map()
            };

            const rawContent = `
        ({
          init: function(cmp) {
            jQuery('.cls').show();
            document.getElementById('id');
          }
        })
      `;

            const metrics = MetricExtractor.extractAuraMetrics(markup, rawContent);

            expect(metrics.hasJQuery).toBe(true);
            expect(metrics.hasDomManipulation).toBe(true);
        });
    });

    describe('extractVfMetrics', () => {
        it('should extract metrics from VF page', () => {
            const page: ParsedVfPage = {
                pageName: 'TestPage',
                pageAttributes: { controller: 'MyController', extensions: ['Ext'] },
                components: [{ name: 'apex:form', attributes: {}, children: [], location: {} }],
                expressions: [],
                actionFunctions: [],
                remoteActions: [{ controller: 'MyController', method: 'remote' }],
                rerenderedSections: [],
                includedScripts: [],
                includedStyles: [],
                customJavaScript: [],
                body: []
            };

            const rawContent = '<apex:page controller="MyController" extensions="Ext">...</apex:page>';

            const metrics = MetricExtractor.extractVfMetrics(page, rawContent);

            expect(metrics.hasExtensions).toBe(true);
            expect(metrics.hasRemoteActions).toBe(true);
            expect(metrics.dependencyCount).toBe(1);
        });
    });
});
