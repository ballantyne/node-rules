var isEqual = require('lodash.isequal');
var filterd = require('lodash.filter');
var clonedeep = require('lodash.clonedeep');
var matches = require('lodash.matches');

class RuleEngine {
  constructor(rules, options) {
    this.init();
    if (typeof(rules) != "undefined") {
      this.register(rules);
    }
    if (options) {
      this.ignoreFactChanges = options.ignoreFactChanges;
    }
    return this;
  }

  init(rules) {
    this.rules = [];
    this.activeRules = [];
  }
  
  register(rules) {
    if (Array.isArray(rules)) {
      this.rules = this.rules.concat(rules);
    } else if (rules !== null && typeof(rules) == "object") {
      this.rules.push(rules);
    }
    this.sync();
  }
  
  sync() {
    this.activeRules = this.rules.filter(function(a) {
      if (typeof(a.on) === "undefined") {
        a.on = true;
      }
      if (a.on === true) {
        return a;
      }
    });
    this.activeRules.sort(function(a, b) {
      if (a.priority && b.priority) {
        return b.priority - a.priority;
      } else {
        return 0;
      }
    });
  }

  execute(fact, callback) {
    //these new attributes have to be in both last session and current session to support
    // the compare function
    var complete = false;
    fact.result = true;
    var session = clonedeep(fact);
    var lastSession = clonedeep(fact);
    var _rules = this.activeRules;
    var matchPath = [];
    var ignoreFactChanges = this.ignoreFactChanges;
    (function FnRuleLoop(x) {
      var API = {
        "rule": function() { return _rules[x]; },
        "when": function(outcome) {
          if (outcome) {
            var _consequence = _rules[x].consequence;
            _consequence.ruleRef = _rules[x].id || _rules[x].name || 'index_'+x;
            process.nextTick(function() {
              matchPath.push(_consequence.ruleRef);
              _consequence.call(session, API, session);
            });
          } else {
            process.nextTick(function() {
              API.next();
            });
          }
        },
        "restart": function() {
          return FnRuleLoop(0);
        },
        "stop": function() {
          complete = true;
          return FnRuleLoop(0);
        },
        "next": function() {
          if (!ignoreFactChanges && !isEqual(lastSession, session)) {
            lastSession = clonedeep(session);
            process.nextTick(function() {
              API.restart();
            });
          } else {
            process.nextTick(function() {
              return FnRuleLoop(x + 1);
            });
          }
        }
      };
      if (x < _rules.length && complete === false) {
        var _rule = _rules[x].condition;
        _rule.call(session, API, session);
      } else {
        process.nextTick(function() {
          session.matchPath = matchPath;
          return callback(session);
        });
      }
    })(0);
  }

  findRules(filter) {
    if (typeof(filter) === "undefined") {
      return this.rules;
    } else {
      var find = matches(filter);
      return filterd(this.rules, find);
    }
  }
  
  turn(state, filter) {
    var state = (state === "on" || state === "ON") ? true : false;
    var rules = this.findRules(filter);
    for (var i = 0, j = rules.length; i < j; i++) {
      rules[i].on = state;
    }
    this.sync();
  }
  
  prioritize(priority, filter) {
    priority = parseInt(priority, 10);
    var rules = this.findRules(filter);
    for (var i = 0, j = rules.length; i < j; i++) {
      rules[i].priority = priority;
    }
    this.sync();
  }
  
  toJSON() {
    var rules = this.rules;
    if (rules instanceof Array) {
      rules = rules.map(function(rule) {
        rule.condition = rule.condition.toString();
        rule.consequence = rule.consequence.toString();
        return rule;
      });
    } else if (typeof(rules) != "undefined") {
      rules.condition = rules.condition.toString();
      rules.consequence = rules.consequence.toString();
    }
    return rules;
  }

  fromJSON(rules) {
    this.init();
    if (typeof(rules) == "string") {
      rules = JSON.parse(rules);
    }
    if (rules instanceof Array) {
      rules = rules.map(function(rule) {
        rule.condition = eval("(" + rule.condition + ")");
        rule.consequence = eval("(" + rule.consequence + ")");
        return rule;
      });
    } else if (rules !== null && typeof(rules) == "object") {
      rules.condition = eval("(" + rules.condition + ")");
      rules.consequence = eval("(" + rules.consequence + ")");
    }
    this.register(rules);
  }
}

module.exports = RuleEngine;
