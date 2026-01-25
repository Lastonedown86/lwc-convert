import { VfGrader } from '../../../src/grading/vf-grader';
import * as fileIo from '../../../src/utils/file-io';

// Mock file-io
jest.mock('../../../src/utils/file-io');

describe('VfGrader', () => {
    let grader: VfGrader;

    beforeEach(() => {
        grader = new VfGrader();
        jest.clearAllMocks();
    });

    it('should grade a simple page as A', async () => {
        (fileIo.readVfPage as jest.Mock).mockResolvedValue({
            name: 'SimplePage',
            path: '/path/to/SimplePage.page',
            markup: '<apex:page standardController="Account"><apex:detail/></apex:page>'
        });

        const grade = await grader.grade('/path/to/SimplePage.page');

        expect(grade.letterGrade).toBe('A');
        expect(grade.overallScore).toBeGreaterThanOrEqual(90);
    });

    it('should grade a complex page lower', async () => {
        (fileIo.readVfPage as jest.Mock).mockResolvedValue({
            name: 'ComplexPage',
            path: '/path/to/ComplexPage.page',
            markup: `
        <apex:page controller="MyController" extensions="Ext1" renderAs="pdf">
          <script>
            function doStuff() {
              Visualforce.remoting.Manager.invokeAction('MyController.method', ...);
              jQuery('#id').hide();
            }
          </script>
        </apex:page>
      `
        });

        const grade = await grader.grade('/path/to/ComplexPage.page');

        expect(grade.overallScore).toBeLessThan(90);
        expect(grade.overallScore).toBeLessThan(90);
        expect(grade.complexityFactors.some(f => f.factor.includes('Render as PDF'))).toBe(true);
        expect(grade.complexityFactors.some(f => f.factor.includes('RemoteActions'))).toBe(true);
        expect(grade.complexityFactors.some(f => f.factor.includes('Uses jQuery'))).toBe(true);
        expect(grade.complexityFactors.some(f => f.factor.includes('inline JavaScript'))).toBe(true);
        expect(grade.complexityFactors.some(f => f.factor.includes('controller extensions'))).toBe(true);
    });
});
