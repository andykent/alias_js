// An advanced aliasing method. Some examples.
// alias('a').as('b'); 
// -> calls to b() are redirected to a()
// alias('a', 'b', 'c').as('x'); 
// -> calls to x() will call a(), b(), c() in order
// alias('a').withSourceScope(window).as('b'); 
// -> calls to window.b() get routed to a() in the current scope
// alias('a').as('b', 'c').withNamedCaller(); 
// -> calls to b(args) are redirected to a('b', args), useful for method missing like functionality
// alias('a').as('b').delayBy(1000); 
// -> calls to b() are redirected to a() after a 1 second delay
// alias('a').withScope(myLib).beforeEach(myBeforeFilter).as('a');
// -> calls will be passed to the original function but a filter will be run before each invocation
// alias('a').as('b').once();
// -> the first call to b() is redirected to a() after which the call chain is reverted back to normal
// alias('a').beforeEach(myFunc).as('a');
// -> myFunc(args) is called before every call to a()

function alias() {
	var scope = this;
	var Alias = function(sources) {
		this.withScope(scope, scope);
		this.sources = sources;
	};
	
	Alias.globalScope = window; // assume we are in a browser and so set the global scope to be the window object.

	Alias.prototype = {
		destinationScope: null,
		sourceScope: null,
		sources: [],
		destinations: [],
		includeFunctionName: false,
		delayPeriod: 0,
		beforeEachFilters: [],
		afterEachFilters: [],
		beforeAllFilters: [],
		afterAllFilters: [],
		history: [],
		baseCallCount: 0,

		as: function() {
			this.destinations = arguments;
			return this.apply();
		},

		withNamedCaller: function() { this.includeFunctionName = true; return this; },
		withAnonymousCaller: function() { this.includeFunctionName = false; return this; },		

		withScope: function(source, dest) {
			this.sourceScope = source;
			this.destinationScope = dest || source;
			return this;
		},

		withSourceScope: function(scope) { return this.withScope(scope, this.destinationScope); },
		withDestinationScope: function(scope) { return this.withScope(this.sourceScope, scope); },

		delayBy: function(time) {
			this.delayPeriod = time;
			return this;
		},
		
		beforeEach: function(func) {
			this.beforeEachFilters.push(func);
			return this;
		},
		
		afterEach: function(func) {
			this.afterEachFilters.push(func);
			return this;
		},
		
		beforeAll: function(func) {
			this.beforeAllFilters.push(func);
			return this;
		},
		
		afterAll: function(func) {
			this.afterAllFilters.push(func);
			return this;
		},

		apply: function() {
			var a = this;
			var applyToDestination = function(dest) {
				var destinationFunction = a._getObject(a.destinationScope, dest);
				if(destinationFunction) { // we are about to do an overwrite so check for infinate loops!
					for (var sc=0; sc < a.sources.length; sc++) {
						var sourceFunction = a._getObject(a.sourceScope, a.sources[sc]);
						if(sourceFunction==destinationFunction) { // potential infinate loop found, lets move the source function
							var originalSource = a.sources[sc];
							var source = a.sources[sc] = '___'+originalSource.replace('.', '_')+'_alias_'+Math.floor(Math.random()*999999)+'___'; // add a random element to help ensure uniqueness
							a._setObject(a.sourceScope, a.sources[sc], sourceFunction);
							var sourceFunctionForUndo = sourceFunction;
							a._undo(function() {
								a._setObject(a.sourceScope, source, undefined);
								a._setObject(a.sourceScope, originalSource, sourceFunctionForUndo);
							});
						}
					}
				}
				a._setObject(a.destinationScope, dest, function() { // start of aliased function
					if (a.includeFunctionName) {
						var args = [dest];
						for (var arg=0; arg < arguments.length; arg++) {
							args.push(arguments[arg]);
						}
					} else { var args = arguments; }
					
					var execute = function() {
						a.baseCallCount++;
						if(!(args = a._runFilters('before', a.beforeAllFilters, a.sourceScope, args))) return;
						for (var sc=0; sc < a.sources.length; sc++) {
							if(!(args = a._runFilters('before', a.beforeEachFilters, a.sourceScope, args))) return;
							var retVal = a._getObject(a.sourceScope, a.sources[sc]).apply(a.sourceScope, args);
							if(!(retVal = a._runFilters('after', a.afterEachFilters, a.sourceScope, [retVal]))) return;
						}	
						if(!(retVal = a._runFilters('after', a.afterAllFilters, a.sourceScope, [retVal]))) return;
						return retVal;
					};
					return a.delayPeriod ? window.setTimeout(execute, a.delayPeriod) : execute();
				}); // end of aliased function
				
				a._undo(function() { a._setObject(a.destinationScope, dest, undefined) });
			};

			for (var d=0; d < a.destinations.length; d++) {
				applyToDestination(a.destinations[d]);
			};
			return this;
		},
		
		revert: function(times){
			if(times) {
				var a = this;
				this.afterAll(function() { if(a.callCount()==times) a._doRevert(); });
			} else {
				this._doRevert();
			}
			return this;
		},
		
		callCount: function() { return this.baseCallCount; },
		
		resetCallCount: function() {
			this.baseCallCount = 0;
			return this;
		},
		
		once: function() { return this.revert(1); },
		
		// - Private -
		
		_getObject: function(scope, ref) {
			try {
				if(typeof scope == 'string') scope = this._getObject(Alias.globalScope, scope);
				if(typeof ref == 'string') {
					var refs = ref.split('.');
					for(var i=0; i<refs.length; i++) { scope = scope[refs[i]]; };
					ref = scope;
				}
				return ref;
			} catch(e) {
				return undefined;
			}
		},
		
		_setObject: function(scope, ref, val) {
			if(typeof scope == 'string') scope = this._getObject(Alias.globalScope, scope); 
			if(typeof ref == 'string') {
				var refs = ref.split('.');
				for(var i=0; i<refs.length; i++) {
					if(i!=refs.length-1) {
						if(scope[refs[i]]==undefined)	scope[refs[i]] = function() {}; // use empty function so we get a pointer to undefined objects
						scope = scope[refs[i]];
					} else scope[refs[i]] = val;
				}
			} else ref = val;
			return val;
		},
		
		_doRevert: function(){
			for(var h=0; h<this.history.length; h++) { this.history[h](); }
			this.history = [];
		},
		
		_runFilters: function(type, filters, scope, args) {
			for(var f=0; f < filters.length; f++) {
				try {
					var retVal = filters[f].apply(this._getObject(Alias.globalScope, scope), args); 
					args = retVal || (type=='before' ? args : args[0]);
				} catch(e) {
					if(e=='halt') {
						args = false; 
						break;
					} else throw(e);
				}
			}
			return args;
		},
		
		_undo: function(func) { this.history.unshift(func); }
	};
	
	return new Alias(arguments); 
}

// TODO
// - tidy up scoping
// - make scoping dot syntax work for filters too so you can pass filters in as string pointers
// - allow a dot at the start to mean from root rather than current scope??
// - decide what should be returned from a chained alias, eg alias('a', 'b').as('c'); c() -> undefined
