var ROOT = process.cwd();
var path= require("path")
var http = require("http");
var fs = require("fs");
var express = require("express");
var request = require('request');
var logging = require("log4js");
var logger = logging.getLogger('angoose');
require("jasmine-custom-message");
var preCompileCalled = false,postCompileCalled=false;
var util = require("./test-util");

//require("./server"); //.startServer(configs);
var userdata =  util.testuser;
// these tests cannot be run together with others 
console.log("****** TEST: hooks-spec ***** ");
var angoose = require("../lib/angoose");

if(!angoose.initialized){
    doTests();
}
function doTests(){   
 
    describe("Hooks Sequence Tests", function(){
        console.log("****** TEST: sequence-test starts ***** ");
        var flag = {};
        beforeEach(function(){
            flag = {};
        })
        var hk = {
                preAuthorize: function(next, invocation, callback){
                    console.log("in preAuthorize hook", arguments)
                    //expect(flag).toBe("init")
                    flag.hook = 'pre';
                    next();
                },
                postAuthorize: function(next, invocation, callback){
                    console.log("in postAuthorize hook", arguments);
                    // why post hook is receiving the invocation arguments?
                    //expect(flag).toBe("preauthorize")
                    flag.hook = 'post';
                    flag.postauth = invocation.method;
                    //next(new Error("post bad"));
                    next();
                },
                postInvoke: function(next){
                    //console.log("POST INVOKE", arguments);
                    next();
                }
            }
        angoose.extension('HookTest', hk)        
        angoose = util.initAngoose(null);
        
        // IMPORTANT: post hooks will be bypassed if main method returns error
        // IMPORTANT: post hooks will be called with main method arguments if no error
        // hooks must return new Error() to report error 
        // 
        it("PostHooks with arguments", function(done){
            var service =  angoose.client().module('SampleService');
            service.listFavoriteDestinations(function(err, places){
                console.log("places", err, places);
                expect(flag.postauth).toBe('listFavoriteDestinations');
                done();    
            });
        });
        it("Hook sequence", function(done){
            var SU =  angoose.client().module('SampleUser');
            SU.findOne(function(err, u){
                expect(flag.hook).toBe('post');
                done();    
            });
        });
        
        it("Post Hook with error", function(done){
            var SS =  angoose.client().module('SampleService');
            SS.testErrorBack(function(err, u){
                console.log("post hook", err, u)
                expect(err).toBeTruthy();
                done();    
            });
        });
    });
    
}


 

