import * as fs from 'fs';
import * as path from 'path';
import { parseVfPage } from '../../../src/parsers/vf/page-parser';
import { transformVfMarkup } from '../../../src/transformers/vf-to-lwc/markup';
import { generateDataAccessLayer } from '../../../src/transformers/vf-to-lwc/data-binding';

describe('VF Formula Functions to JS Getters', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/vf');
  let formulaPage: string;

  beforeAll(() => {
    formulaPage = fs.readFileSync(path.join(fixturesPath, 'FormulaPage.page'), 'utf-8');
  });

  test('should detect NOT(ISBLANK()) formula and generate getter', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    // Should have detected formulas
    expect(transformed.detectedFormulas.length).toBeGreaterThan(0);

    // Find NOT(ISBLANK) formula
    const hasContactFormula = transformed.detectedFormulas.find(
      f => f.original.includes('NOT') && f.original.includes('ISBLANK') && f.original.includes('contactRecord')
    );
    expect(hasContactFormula).toBeDefined();
    expect(hasContactFormula?.getterName).toBe('hasContactRecord');
    expect(hasContactFormula?.suggestedLogic).toContain('this.contactRecord');
    expect(hasContactFormula?.suggestedLogic).toContain('!');
  });

  test('should detect simple ISBLANK() formula', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    const isBlankFormula = transformed.detectedFormulas.find(
      f => f.original.includes('ISBLANK') && f.original.includes('selectedId')
    );
    expect(isBlankFormula).toBeDefined();
    expect(isBlankFormula?.getterName).toBe('isSelectedIdEmpty');
  });

  test('should detect AND() formula with multiple conditions', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    const andFormula = transformed.detectedFormulas.find(
      f => f.original.includes('AND')
    );
    expect(andFormula).toBeDefined();
    expect(andFormula?.getterName).toBe('combinedCondition');
    expect(andFormula?.suggestedLogic).toContain('&&');
    expect(andFormula?.suggestedLogic).toContain('this.isAdmin');
    expect(andFormula?.suggestedLogic).toContain('this.hasPermission');
  });

  test('should detect OR() formula with multiple conditions', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    const orFormula = transformed.detectedFormulas.find(
      f => f.original.includes('OR')
    );
    expect(orFormula).toBeDefined();
    expect(orFormula?.getterName).toBe('anyCondition');
    expect(orFormula?.suggestedLogic).toContain('||');
  });

  test('should detect simple NOT() formula', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    const notFormula = transformed.detectedFormulas.find(
      f => f.original === 'NOT(isDisabled)'
    );
    expect(notFormula).toBeDefined();
    expect(notFormula?.getterName).toBe('isNotIsDisabled');
    expect(notFormula?.suggestedLogic).toContain('!');
  });
});

describe('Controller Property Bindings to JS Properties', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/vf');
  let formulaPage: string;

  beforeAll(() => {
    formulaPage = fs.readFileSync(path.join(fixturesPath, 'FormulaPage.page'), 'utf-8');
  });

  test('should detect controller property bindings', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    // Should have detected controller properties
    expect(transformed.controllerProperties.length).toBeGreaterThan(0);

    // Find contactRecord property
    const contactProp = transformed.controllerProperties.find(
      p => p.name === 'contactRecord'
    );
    expect(contactProp).toBeDefined();
    expect(contactProp?.fields).toContain('Name');
    expect(contactProp?.fields).toContain('Email');
  });

  test('should merge fields for same property binding', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    const contactProp = transformed.controllerProperties.find(
      p => p.name === 'contactRecord'
    );
    // Both Name and Email should be in the same property
    expect(contactProp?.fields.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Conditional lightning-record-edit-form Generation', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/vf');
  let formulaPage: string;

  beforeAll(() => {
    formulaPage = fs.readFileSync(path.join(fixturesPath, 'FormulaPage.page'), 'utf-8');
  });

  test('should track hasInputFields correctly', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    // Page has forms with inputs
    expect(transformed.hasInputFields).toBe(true);
  });

  test('should generate lightning-record-edit-form only for forms with inputs', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const transformed = transformVfMarkup(parsed);

    // Count occurrences of lightning-record-edit-form
    const editFormCount = (transformed.html.match(/lightning-record-edit-form/g) || []).length;
    
    // Should have lightning-record-edit-form for the form with inputs
    expect(editFormCount).toBeGreaterThan(0);
    
    // Check that display-only form uses div wrapper
    expect(transformed.html).toContain('Form without inputs');
    expect(transformed.html).toContain('class="slds-form"');
  });

  test('display-only form should not generate lightning-record-edit-form', () => {
    // Parse a page with only display form
    const displayOnlyPage = `<apex:page>
      <apex:form id="displayOnly">
        <apex:outputText value="{!name}"/>
        <apex:outputField value="{!Account.Name}"/>
      </apex:form>
    </apex:page>`;
    
    const parsed = parseVfPage(displayOnlyPage, 'DisplayOnlyPage');
    const transformed = transformVfMarkup(parsed);
    
    // Should NOT have lightning-record-edit-form
    expect(transformed.html).not.toContain('lightning-record-edit-form');
    expect(transformed.html).toContain('slds-form');
    expect(transformed.hasInputFields).toBe(false);
  });
});

describe('ActionFunction with Params - Imperative Pattern', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/vf');
  let formulaPage: string;

  beforeAll(() => {
    formulaPage = fs.readFileSync(path.join(fixturesPath, 'FormulaPage.page'), 'utf-8');
  });

  test('should detect actionFunction with parameters', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    
    // Should have action functions
    expect(parsed.actionFunctions.length).toBeGreaterThanOrEqual(2);
    
    const updateRecord = parsed.actionFunctions.find(af => af.name === 'updateRecord');
    expect(updateRecord).toBeDefined();
    expect(updateRecord?.action).toContain('saveRecord');
    expect(updateRecord?.rerender).toBe('resultPanel');
  });

  test('should generate imperative pattern for actionFunction with params', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const dataAccess = generateDataAccessLayer(parsed);

    // Find the updateRecord method (which has params)
    const updateRecordMethod = dataAccess.methods.find(m => m.includes('updateRecord'));
    expect(updateRecordMethod).toBeDefined();
    
    // Should have parameters in the method signature
    expect(updateRecordMethod).toContain('recordId');
    expect(updateRecordMethod).toContain('newValue');
    
    // Should use imperative pattern (async/await with try/catch)
    expect(updateRecordMethod).toContain('async');
    expect(updateRecordMethod).toContain('await');
    expect(updateRecordMethod).toContain('try');
    expect(updateRecordMethod).toContain('catch');
    
    // Should mention it uses imperative pattern
    expect(updateRecordMethod).toContain('imperative');
  });

  test('should generate simpler method for actionFunction without params', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const dataAccess = generateDataAccessLayer(parsed);

    // Find the refreshData method (which has no params)
    const refreshDataMethod = dataAccess.methods.find(m => m.includes('refreshData'));
    expect(refreshDataMethod).toBeDefined();
    
    // Should have empty parameter list
    expect(refreshDataMethod).toMatch(/refreshData\s*\(\s*\)/);
  });

  test('should add warning for actionFunction with params', () => {
    const parsed = parseVfPage(formulaPage, 'FormulaPage');
    const dataAccess = generateDataAccessLayer(parsed);

    // Should have warning about imperative pattern
    const paramWarning = dataAccess.warnings.find(w => 
      w.includes('updateRecord') && w.includes('parameters') && w.includes('imperative')
    );
    expect(paramWarning).toBeDefined();
  });
});

describe('LMS to ActionFunction Auto-Wiring', () => {
  test('should auto-wire handleMessage to actionFunction when sforce.one.subscribe pattern detected', () => {
    const vfPageWithLms = `<apex:page controller="TestController">
      <script>
        sforce.one.subscribe(recordChannel, function(message) {
          refreshContactsFunction(message.recordId);
        });
      </script>
      <apex:outputText value="{!$MessageChannel.Record_Channel__c}"/>
      <apex:actionFunction name="refreshContactsFunction" action="{!refreshContacts}" rerender="panel">
        <apex:param name="Id" assignTo="{!selectedId}" value=""/>
      </apex:actionFunction>
    </apex:page>`;
    
    const parsed = parseVfPage(vfPageWithLms, 'LmsPage');
    const dataAccess = generateDataAccessLayer(parsed);
    
    // Find the LMS wire declaration
    const lmsWire = dataAccess.wireDeclarations.find(w => w.includes('MessageContext'));
    expect(lmsWire).toBeDefined();
    
    // Should have auto-wired handleMessage to call refreshContactsFunction
    expect(lmsWire).toContain('handleMessage');
    expect(lmsWire).toContain('refreshContactsFunction');
    expect(lmsWire).toContain('message.recordId');
    
    // Should have a warning about the auto-wiring
    const autoWireWarning = dataAccess.warnings.find(w => 
      w.includes('LMS') && w.includes('auto-wired') && w.includes('refreshContactsFunction')
    );
    expect(autoWireWarning).toBeDefined();
  });
  
  test('should handle arrow function syntax in subscribe', () => {
    const vfPageWithArrow = `<apex:page controller="TestController">
      <script>
        sforce.one.subscribe(channel, (msg) => {
          updateRecord(msg.contactId);
        });
      </script>
      <apex:outputText value="{!$MessageChannel.Test_Channel__c}"/>
      <apex:actionFunction name="updateRecord" action="{!doUpdate}"/>
    </apex:page>`;
    
    const parsed = parseVfPage(vfPageWithArrow, 'ArrowPage');
    const dataAccess = generateDataAccessLayer(parsed);
    
    const lmsWire = dataAccess.wireDeclarations.find(w => w.includes('MessageContext'));
    expect(lmsWire).toBeDefined();
    expect(lmsWire).toContain('updateRecord');
    expect(lmsWire).toContain('message.contactId');
  });
  
  test('should fall back to TODO when no subscribe pattern found', () => {
    const vfPageNoPattern = `<apex:page controller="TestController">
      <apex:outputText value="{!$MessageChannel.Test_Channel__c}"/>
      <apex:actionFunction name="someAction" action="{!doAction}"/>
    </apex:page>`;
    
    const parsed = parseVfPage(vfPageNoPattern, 'NoPatternPage');
    const dataAccess = generateDataAccessLayer(parsed);
    
    const lmsWire = dataAccess.wireDeclarations.find(w => w.includes('MessageContext'));
    expect(lmsWire).toBeDefined();
    // Should have TODO placeholder when no pattern detected
    expect(lmsWire).toContain('TODO');
  });
  
  test('should auto-wire when config-based pattern detected (actionFunction: name, lmsSubscribe: sforce.one.subscribe)', () => {
    // This pattern is used when VF page passes config to an external JS module
    const vfPageConfigBased = `<apex:page controller="LMSVisualforceController">
      <apex:outputText value="{!$MessageChannel.Record_Selected__c}"/>
      <apex:actionFunction action="{!refreshContact}" name="refreshContactsFunction" reRender="contactlist">
        <apex:param name="Id" value="" />
      </apex:actionFunction>
      <script type="module">
        import { setPageConfigs } from '{!URLFOR($Resource.lmsvf, 'lmsSubscriberVisualforcePostbackAction.js')}';
        setPageConfigs({
            messageChannel: '{!$MessageChannel.Record_Selected__c}',
            actionFunction: refreshContactsFunction,
            lmsSubscribe: sforce.one.subscribe
        });
      </script>
    </apex:page>`;
    
    const parsed = parseVfPage(vfPageConfigBased, 'ConfigBasedPage');
    const dataAccess = generateDataAccessLayer(parsed);
    
    const lmsWire = dataAccess.wireDeclarations.find(w => w.includes('MessageContext'));
    expect(lmsWire).toBeDefined();
    
    // Should auto-wire handleMessage to call refreshContactsFunction
    expect(lmsWire).toContain('refreshContactsFunction');
    expect(lmsWire).toContain('message.recordId');
    
    // Should have a warning about the auto-wiring
    const autoWireWarning = dataAccess.warnings.find(w => 
      w.includes('LMS') && w.includes('auto-wired') && w.includes('refreshContactsFunction')
    );
    expect(autoWireWarning).toBeDefined();
  });
});
