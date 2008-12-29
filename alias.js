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

		apply: function() {
			var a = this;
			var applyToDestination = function(dest) {
				a.destinationScope[dest] = function() {
					if (a.includeFunctionName) {
						var args = [dest];
						for (var arg=0; arg < arguments.length; arg++) {
							args.push(arguments[arg]);
						};
					} else var args = arguments;
					var execute = function() {
						for (var sc=0; sc < a.sources.length; sc++) {
							a.sourceScope[a.sources[sc]].apply(a.sourceScope, args);
						};
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