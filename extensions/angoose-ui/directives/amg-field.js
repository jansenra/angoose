(function(){
angular.module('angoose.ui.directives').directive('deformField', function($compile, $templateCache, $interpolate, $injector, $controller, $ui) {
  

  // Find the "input" element in the template.  It will be one of input, select or textarea.
  // We need to ensure it is wrapped in jqLite\jQuery
  function findInputElement(templateElement) {
    return angular.element(templateElement.find('input')[0] || templateElement.find('select')[0] || templateElement.find('textarea')[0]);
  }

  function findLabelElement(templateElement) {
    return templateElement.find('label');
  }

  // Search through the originalDirective's element for elements that contain information about how to map
  // validation keys to messages
  function getValidationMessageMap(originalElement) {
    // Find all the <validator> child elements and extract their (key, message) info
    var validationMessages = {};
    angular.forEach(originalElement.find('validator'), function(element) {
      // Wrap the element in jqLite/jQuery
      element = angular.element(element);
      // Store the message info to be provided to the scope later
      // The content of the validation element may include interpolation {{}}
      // so we will actually store a function created by the $interpolate service
      // To get the interpolated message we will call this function with the scope. e.g.
      //   var messageString = getMessage(scope);
      validationMessages[element.attr('key')] = $interpolate(element.text());
    });
    return validationMessages;
  }

  // Find the content that will go into the new label
  // Label is provided as a <label> child element of the original element
  function getLabelContent(element) {
    var label = element.find('label');
    return label[0] && label.html();
  }
  
  function getTemplateContent(element){
      var em = element.find('template');
      if(!em) return null;
      if(!em.attr('name') && ! em.attr("url"))
        return em[0] && em.html();
      return em.attr('name') || em.attr('url');
  }

    
  return {
    restrict:'E',
    scope:{
      instance:'=',
      path:'=',
      modelSchema:'=',
      fieldSchema:'=',
      readonly:'@'
    },
    //require:'?ngModel',
    priority: 100,        // We need this directive to happen before ng-model
    terminal: true,       // We are going to deal with this element
    compile: function(element, attrs) {
      if ( attrs.ngRepeat || attrs.ngSwitch || attrs.uiIf ) {
        throw new Error('The ng-repeat, ng-switch and ui-if directives are not supported on the same element as the field directive.');
      }
      if ( !attrs.ngModel ) {
        throw new Error('The ng-model directive must appear on the field element');
      }

      // Extract the label and validation message info from the directive's original element
      var validationMessages = getValidationMessageMap(element);
      var labelContent = getLabelContent(element);
      
      // Clear the directive's original element now that we have extracted what we need from it
      element.html('');
        
      return function postLink(scope, element, attrs, ngModelController) {
          
        window.pscope = scope;
        if(scope.path && scope.path.indexOf("_") == 0) return;
        
        enterscope(scope, "deform-field "+ scope.path)
        var customTemplate  =  attrs.template;
        var customController = attrs.controller;
        var customDirective = attrs.directive;
        
        
         
        //var schema = getSchema( scope.instance).paths[scope.path] ;
        var modelSchema = scope.modelSchema;
        //if(!modelSchema) console.error("Model schema lost in scope ", scope.$id, "parent is ", scope.$parent.$id)
        
        var schema = scope.fieldSchema;
        if(!schema) 
            return console.error("Missing schema for path", scope.path);
        schema.options = schema.options || {};    
        
        var directive = customDirective || mapDirective(scope.path, schema, modelSchema)
        var template = customTemplate || mapTemplate(scope.path, schema, modelSchema);
        console.log("Field ", scope.path,  "template", template );
        var labelContent = schema.options.label ||schema.options.name || scope.path;
        
        var childScope = scope.$new();
        
        function handleDirective(directive, childScope){
            var html = '<directive-name path="path" model-schema="model-schema" field-schema="fieldSchema" instance="instance"></directive-name>';
            html = html.replace('directive-name', directive);
            var directiveElement = angular.element(html);
            var labelElement = directiveElement.find('label');
            labelElement.attr('for', childScope.$fieldId);
            // Update the label's contents
            labelElement.html(labelContent  );
            element.append(directiveElement);
            $compile(directiveElement)(childScope);
        }
        
        console.log("Created child scope for deform-field ", scope.path,  childScope.$id, "using directive: ",directive)
        if(directive){
            handleDirective( directive, childScope);
        }      
        else
        {
            
            // Load up the template for this kind of field, default to the simple input if none given
            $ui.loadFieldTemplate(template ).then(function(templateElement) {
              // Set up the scope - the template will have its own scope, which is a child of the directive's scope
              
              // Attach a copy of the message map to the scope
              childScope.$validationMessages = angular.copy(validationMessages);
              // Generate an id for the field from the ng-model expression and the current scope
              // We replace dots with underscores to work with browsers and ngModel lookup on the FormController
              // We couldn't do this in the compile function as we need to be able to calculate the unique id from the scope
              childScope.$fieldId = attrs.ngModel.replace('.', '_').toLowerCase() + '_' + childScope.$id;
              childScope.$fieldLabel = labelContent;
    
              // Update the $fieldErrors array when the validity of the field changes
              childScope.$watch('$field.$dirty && $field.$error', function(errorList) {
                  console.log("Got error", errorList);
                childScope.$fieldErrors = [];
                angular.forEach(errorList, function(invalid, key) {
                  if ( invalid ) {
                    childScope.$fieldErrors.push(key);
                  }
                });
              }, true);
    
    
              // Copy over all left over attributes to the input element
              // We can't use interpolation in the template for directives such as ng-model
              var inputElement = findInputElement(templateElement);
              angular.forEach(attrs.$attr, function (original, normalized) {
                var value = element.attr(original);
                inputElement.attr(original, value);
              });
              inputElement.attr("ng-model", "instance."+ scope.path);
              //console.trace("NGMODEL #### ", inputElement.attr('ng-model'))
    
              // Wire up the input (id and name) and its label (for).
              // We need to set the input element's name here before we compile the template.
              // If we leave it to be interpolated at the next $digest the formController doesn't pick it up
              inputElement.attr('name', childScope.$fieldId);
              inputElement.attr('id', childScope.$fieldId);
              if(scope.readonly || schema.options.readonly === true) inputElement.attr('readonly', "true");
              schema.options.required && inputElement.attr('required', 'true');
              var labelElement = templateElement.find('label');
              labelElement.attr('for', childScope.$fieldId);
              // Update the label's contents
              labelElement.html(labelContent);
    
              // Place our template as a child of the original element.
              // This needs to be done before compilation to ensure that it picks up any containing form.
              element.append(templateElement);
    
                // filed controller
                //var fieldController = customController || "dfController"+ camelcase(template);
                var fieldController = customController || "dfc-"+template;
                console.log("Invoking custom controller", fieldController);
                try{  $controller(fieldController, {$scope: childScope, $schema: schema, inputElement: inputElement, templateElement: templateElement}) }
                catch(err){
                    //console.error("fieldControoler error", err)
                }
                // We now compile and link our template here in the postLink function
                // This allows the ng-model directive on our template's <input> element to access the ngFormController
                $compile(templateElement)(childScope);
    
                // Now that our template has been compiled and linked we can access the <input> element's ngModelController
                childScope.$field = inputElement.controller('ngModel');
                window.ngModelCtrl = childScope.$field
                          
    
            });
          } // end loadTemplate
      }; // end postLink
    }
  };
});

// ** mapDirective **
//
// Default mapping based on schema definition:

// - list of sub schemas: deform-sublist
// - single subschema object: deform-subschema
 
function mapDirective(path, pathSchema, modelSchema){
    if(! pathSchema.schema)  return null;
    
    if(pathSchema.options && Array.isArray(pathSchema.options.type))
        return "deform-sublist"
    else
        return "deform-subschema"
}    

// ** mapTemplate **
//
// Default mapping for Mongoose schema type -> form field
//      
// - ObjectID: selector
// - Boolean: Checkbox
// - String: input
// - Number: input
// - Date: ? 
// - Array of simple types: selector multi
// - Array of ref objects: selector multi
// - String/Number with enum values:  Select
// - Mixed: ??
//  
function mapTemplate(path, pathSchema, modelSchema){
    if(pathSchema.options.template) return pathSchema.options.template;
    if(pathSchema.options.multiline) return "textarea"
    var template = 'input';
    var opts = pathSchema.options || {};
    //@todo: refactor them into subclasses
    
    switch(pathSchema.instance || (pathSchema.options && pathSchema.options.type)){
        case 'ObjetcID':
            if(opts.ref)    template = 'selector';
            break; 
        case 'Boolean':
            template = 'checkbox';
            break;
        case 'Date':
        case 'String':
        case 'Number':
        default:
            break;
    }
    if(getRef(pathSchema))
        template = "selector";
    if(Array.isArray(opts.enum) && opts.enum.length>0){
        template = "select";
    }
    if(Array.isArray(opts.type )){
        if(pathSchema.caster){
            /** array of simple types */
        }
    }
    
    console.log("Path ", path, " Type ", pathSchema , " template: ", template)
    return template;
}

function getRef(pathSchema){
    var opts = pathSchema.options;
    
    /** Mongoose, array of ObjectIDs */
    if( Array.isArray(opts.type) && opts.type.length>0  &&  opts.type[0] && opts.type[0].ref ) 
        return opts.type[0].ref;
    /** Single ObjectID Reference*/
    if(pathSchema.instance == 'ObjectID' && opts.ref) return opts.ref;
    
    
    if(pathSchema.options.ref && pathSchema.instance == 'CustomRef'){
        /** deform custom ref*/
       return pathSchema.options.ref;    
    }
    /** deform rich reference, array */
    if(Array.isArray(opts.type ) && pathSchema.caster && 
            pathSchema.caster.instance == 'CustomRef' && pathSchema.caster.options.ref ){ 
        return pathSchema.caster.options.ref;
    }
        
    return null;
}
function camelcase(str){
    return str? str.substring(0,1).toUpperCase() + str.substring(1): str;
}
})();  // end enclosure