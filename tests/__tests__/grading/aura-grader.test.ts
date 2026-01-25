import { AuraGrader } from '../../../src/grading/aura-grader';
import * as fileIo from '../../../src/utils/file-io';

// Mock file-io
jest.mock('../../../src/utils/file-io');

describe('AuraGrader', () => {
    let grader: AuraGrader;

    beforeEach(() => {
        grader = new AuraGrader();
        jest.clearAllMocks();
    });

    it('should grade a simple component as A', async () => {
        (fileIo.readAuraBundle as jest.Mock).mockResolvedValue({
            name: 'SimpleCmp',
            path: '/path/to/SimpleCmp',
            markup: '<aura:component><aura:attribute name="val" type="String"/></aura:component>',
            controller: '({ init: function(c,e,h){} })',
            helper: '',
            style: ''
        });

        const grade = await grader.grade('/path/to/SimpleCmp');

        expect(grade.letterGrade).toBe('A');
        expect(grade.overallScore).toBeGreaterThanOrEqual(90);
        expect(grade.complexity).toBe('Simple');
    });

    it('should grade a complex component lower', async () => {
        (fileIo.readAuraBundle as jest.Mock).mockResolvedValue({
            name: 'ComplexCmp',
            path: '/path/to/ComplexCmp',
            markup: `
        <aura:component>
          <aura:handler name="render" value="{!this}" action="{!c.render}"/>
          <ui:button label="Legacy"/>
        </aura:component>
      `,
            controller: `
        ({
          render: function() {
            $A.createComponent("c:dynamic", ...);
            jQuery('.legacy').show();
          }
        })
      `,
            helper: '',
            style: ''
        });

        const grade = await grader.grade('/path/to/ComplexCmp');

        expect(grade.overallScore).toBeLessThan(90);
        expect(grade.complexityFactors.length).toBeGreaterThan(0);
        expect(grade.complexityFactors.some(f => f.factor.includes('jQuery'))).toBe(true);
        expect(grade.complexityFactors.some(f => f.factor.includes('Dynamic component'))).toBe(true);
        expect(grade.complexityFactors.some(f => f.factor.includes('Custom render handler'))).toBe(true);
        expect(grade.complexityFactors.some(f => f.factor.includes('legacy components'))).toBe(true);
    });
});
