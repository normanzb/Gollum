/**
 * @class Gollum
 * Load script under sandboxed execution context to isolate unsafe code.
 */
define(['jquery'], function TrackerGollum($){
    'use strict';

    var NAME = 'Gollum';
    var EX_NO_ARG = NAME + ': Required argument is missing.';
    var EX_NO_DEFFERED = NAME + ': jQuery does not implement Deferred() method.';

    var defaultSettings = {
        url: 'about:blank'
    };

    var Deferred = $.Deferred;

    if (!Deferred){
        throw EX_NO_DEFFERED;
    }

    // @constructor
    // @param opts options: {url: 'The url for iframe.'}.
    function Gollum(opts){

        var me = this;

        me.opts = opts || defaultSettings;

        me.ready = Deferred();

        // It creates the iframe which contains the dirty scripts.
        var $gollum = (function createGollum(){
        
            var ret = $(document.createElement('iframe'));

            ret.attr('src', me.opts.url);

            ret.hide();

            ret.appendTo(document.body);

            return ret;

        })();

        me._$gollum = $gollum;

        // It also make sure that all operation are done after iframe 
        // is properly loaded
        me._$gollum.bind('load', function(){
            $gollum[0].contentWindow.__gollumArgs__ = [];
            me.ready.resolve();
        });
    }

    var p = Gollum.prototype;

    /**
     * Load script under the execution context created by gollum.
     * @param path The script path
     * @api public
     */
    p.load = function(path){
        if (!path){
            throw EX_NO_ARG; 
        }

        var me = this;
        var deferred = Deferred();

        me.ready.done(function(){

            var window = this._$gollum[0].contentWindow;
            var doc = window.document;
            var script = doc.createElement('script');

            script.src = path;

            if (script.completed){
                deferred.resolve();
            }
            else{
                script.onload = function(){
                    deferred.resolve();
                };
            }

            doc.body.appendChild(script);

        });

        return deferred;
    };

    /**
     * Execute a function under the execution context of sub window,
     *     Caveat: The function passed in cannot visit its own execution context.
     * @param func The function to be executed under the sub window, or string that
     *               contains code to be executed.
     * @param ... All the remaining parameters will be passed into 'func'.
     * @api public
     */
    p.exec = function(func){
        if (!func){
            throw EX_NO_ARG;
        }

        var me = this;
        var ret = Deferred();
        var sSource = func.toString();
        var args = Array.prototype.slice.call(arguments, 1);

        me.ready.done(function(){
            var window = me._$gollum[0].contentWindow;
            var document = window.document;

            window.__gollumArgs__.push(Array.prototype.slice.call(args));

            var code = 'this.__gollumRet__ = (' + 
                    sSource + 
                    ').apply(this, this.__gollumArgs__.shift());';

            if (window.execScript){
                // keep direct call to execScript, otherwise code will fail on ie8
                window.execScript(code);
            }
            else{
                window.eval(code)
            }

            ret.resolve(window.__gollumRet__);
        });

        return ret;
    };

    return Gollum;
});