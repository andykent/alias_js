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

function alias() {
	var scope = this;
	var Alias = function(sources) {
		this.withScope(scope, scope);
		this.sources = sources;
	}

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
		
		runFilters: function(filters, scope, args) {
			for(var f=0; f < filters.length; f++) {
				try {
					var retVal = filters[f].apply(scope, args);
					args = retVal || args;
				} catch(e) {
					if(e=='halt') {
						args = false; 
						break;
					} else throw(e);
				}
			};
			return args;
		},

		apply: function() {
			var a = this;
			var applyToDestination = function(dest) {
				var destinationFunction = a.destinationScope[dest]
				if(destinationFunction) { // we are about to do an overwrite so check for infinate loops!
					for (var sc=0; sc < a.sources.length; sc++) {
						var sourceFunction = a.sourceScope[a.sources[sc]];
						if(sourceFunction==destinationFunction) { // potential infinate loop found, lets move the source function
							a.sources[sc] = '___'+a.sources[sc]+'_'+Math.random(9999999)+'___'; // add a random element to help ensure uniqueness
							a.sourceScope[a.sources[sc]] = sourceFunction;
						}
					};
				};
				a.destinationScope[dest] = function() {
					if (a.includeFunctionName) {
						var args = [dest];
						for (var arg=0; arg < arguments.length; arg++) {
							args.push(arguments[arg]);
						};
					} else var args = arguments;
					
					var execute = function() {
						if(!(args = a.runFilters(a.beforeAllFilters, a.sourceScope, args))) return;
						for (var sc=0; sc < a.sources.length; sc++) {
							if(!(args = a.runFilters(a.beforeEachFilters, a.sourceScope, args))) return;
							var retVal = a.sourceScope[a.sources[sc]].apply(a.sourceScope, args);
							if(!(args = a.runFilters(a.afterEachFilters, a.sourceScope, args))) return;
						};
						if(!(args = a.runFilters(a.afterAllFilters, a.sourceScope, args))) return;
						return retVal;
					};
					a.delayPeriod ? setTimeout(execute, a.delayPeriod) : execute();
				};
			};

			for (var d=0; d < a.destinations.length; d++) {
				applyToDestination(a.destinations[d]);
			};
			return this;
		}
	};
	
	return new Alias(arguments); 
};

// TODO
// - allow objects to be passed in as well as strings to withScope(), alias() & as(), this is hard as we need to extract the scope too.
// - allow after filters to modify the return value somehow instead of modifying the arguments as that is a bit pointless
// - add a revert() method to revert back to the non aliased version, involves tracking function creations and renames
// - add a once() method to automatically revert() after the first invocation of a function is complete
// - add beforeFirst() and afterFirst() to support filters on the first invocation of a function