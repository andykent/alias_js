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
				var destinationFunction = a.destinationScope[dest];
				if(destinationFunction) { // we are about to do an overwrite so check for infinate loops!
					for (var sc=0; sc < a.sources.length; sc++) {
						var sourceFunction = a.sourceScope[a.sources[sc]];
						if(sourceFunction==destinationFunction) { // potential infinate loop found, lets move the source function
							var originalSource = a.sources[sc];
							a.sources[sc] = '___'+originalSource+'_'+Math.random(9999999)+'___'; // add a random element to help ensure uniqueness
							a.sourceScope[a.sources[sc]] = sourceFunction;
							a._undo(function() {
								a.sourceScope[a.sources[sc]] = undefined;
								a.sourceScope[originalSource] = sourceFunction;
							});
						}
					}
				}
				a.destinationScope[dest] = function() { // start of aliased function
					if (a.includeFunctionName) {
						var args = [dest];
						for (var arg=0; arg < arguments.length; arg++) {
							args.push(arguments[arg]);
						}
					} else { var args = arguments; }
					
					var execute = function() {
						if(!(args = a._runFilters('before', a.beforeAllFilters, a.sourceScope, args))) return;
						for (var sc=0; sc < a.sources.length; sc++) {
							if(!(args = a._runFilters('before', a.beforeEachFilters, a.sourceScope, args))) return;
							a.baseCallCount++;
							var retVal = a.sourceScope[a.sources[sc]].apply(a.sourceScope, args);
							if(!(retVal = a._runFilters('after', a.afterEachFilters, a.sourceScope, [retVal]))) return;
						}
						if(!(retVal = a._runFilters('after', a.afterAllFilters, a.sourceScope, [retVal]))) return;
						return retVal;
					};
					return a.delayPeriod ? window.setTimeout(execute, a.delayPeriod) : execute();
				}; // end of aliased function
				
				a._undo(function() { a.destinationScope[dest] = undefined; });
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
		
		_fetchObject: function(scope, ref) {
			if(scope typeof 'string') scope = this._findObject(window, scope);
			if(ref typeof 'string') {
				var obj = scope[ref];
			} else return ref;
		},
		
		_doRevert: function(){
			for(var h=0; h<this.history.length; h++) { this.history[h](); }
			this.history = [];
		},
		
		_runFilters: function(type, filters, scope, args) {
			for(var f=0; f < filters.length; f++) {
				try {
					var retVal = filters[f].apply(scope, args);
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
// - allow objects to be passed in as well as strings to withScope(), alias() & as(), this is hard as we need to extract the scope too.
