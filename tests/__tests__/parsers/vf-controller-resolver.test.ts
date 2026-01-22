/**
 * Tests for VF Controller Resolver utility
 */

import { extractControllerNames } from '../../../src/utils/vf-controller-resolver';

describe('VF Controller Resolver', () => {
  describe('extractControllerNames', () => {
    it('should extract controller from controller attribute', () => {
      const markup = '<apex:page controller="AccountController">';
      const result = extractControllerNames(markup);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'AccountController',
        type: 'controller',
      });
    });

    it('should extract extensions from extensions attribute', () => {
      const markup = '<apex:page standardController="Account" extensions="AccountExt1, AccountExt2">';
      const result = extractControllerNames(markup);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'AccountExt1',
        type: 'extension',
      });
      expect(result[1]).toEqual({
        name: 'AccountExt2',
        type: 'extension',
      });
    });

    it('should extract both controller and extensions', () => {
      const markup = '<apex:page controller="MainController" extensions="ExtController1, ExtController2">';
      const result = extractControllerNames(markup);
      
      expect(result).toHaveLength(3);
      expect(result.find(c => c.name === 'MainController')).toEqual({
        name: 'MainController',
        type: 'controller',
      });
      expect(result.find(c => c.name === 'ExtController1')).toEqual({
        name: 'ExtController1',
        type: 'extension',
      });
      expect(result.find(c => c.name === 'ExtController2')).toEqual({
        name: 'ExtController2',
        type: 'extension',
      });
    });

    it('should extract $RemoteAction references', () => {
      const markup = `
<apex:page controller="MyController">
  <script>
    Visualforce.remoting.Manager.invokeAction(
      '{!$RemoteAction.MyController.getData}',
      function(result, event) {}
    );
    Visualforce.remoting.Manager.invokeAction(
      '{!$RemoteAction.AnotherController.fetch}',
      function(result, event) {}
    );
  </script>
</apex:page>`;
      const result = extractControllerNames(markup);
      
      // Should find MyController (from controller attr) and AnotherController (from RemoteAction)
      expect(result).toHaveLength(2);
      expect(result.find(c => c.name === 'MyController')).toEqual({
        name: 'MyController',
        type: 'controller',
      });
      expect(result.find(c => c.name === 'AnotherController')).toEqual({
        name: 'AnotherController',
        type: 'remoteAction',
      });
    });

    it('should extract invokeAction with string literals', () => {
      const markup = `
<script>
  Visualforce.remoting.Manager.invokeAction('RemoteController.callMethod', params);
</script>`;
      const result = extractControllerNames(markup);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'RemoteController',
        type: 'remoteAction',
      });
    });

    it('should not duplicate controllers referenced multiple times', () => {
      const markup = `
<apex:page controller="MyController">
  <script>
    {!$RemoteAction.MyController.method1}
    {!$RemoteAction.MyController.method2}
  </script>
</apex:page>`;
      const result = extractControllerNames(markup);
      
      // Should only have MyController once
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MyController');
    });

    it('should return empty array for pages without controllers', () => {
      const markup = '<apex:page standardController="Account">';
      const result = extractControllerNames(markup);
      
      expect(result).toHaveLength(0);
    });

    it('should handle multiline apex:page tag', () => {
      const markup = `
<apex:page 
  controller="MultilineController"
  sidebar="false"
  showHeader="true">
</apex:page>`;
      const result = extractControllerNames(markup);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MultilineController');
    });

    it('should handle case variations in attribute names', () => {
      const markup = '<apex:page Controller="CaseController">';
      const result = extractControllerNames(markup);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('CaseController');
    });
  });
});
