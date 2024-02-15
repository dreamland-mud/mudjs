
const ace = require('ace-builds/src-noconflict/ace.js');

ace.define('ace/mode/fenia', function(acequire, exports, module) {

var oop = acequire("../lib/oop");
var JavaScriptMode = acequire("./javascript").Mode;
var FeniaHighlightRules = acequire("./fenia_highlight_rules").FeniaHighlightRules;

var Mode = function() {
    JavaScriptMode.call(this);
    this.HighlightRules = FeniaHighlightRules;
};
oop.inherits(Mode, JavaScriptMode);

(function() {

    this.createWorker = function(session) {
        return null;
    };

    this.$id = "ace/mode/fenia";
}).call(Mode.prototype);

exports.Mode = Mode;
});


ace.define('ace/mode/fenia_highlight_rules', function(acequire, exports, module) {

var oop = acequire("../lib/oop");
var DocCommentHighlightRules = acequire("./doc_comment_highlight_rules").DocCommentHighlightRules;
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var FeniaHighlightRules = function() {

    var keywords = (
        "null|if|else|for|break|continue|return|function|var|try|catch|throw"
    );

    var buildinConstants = (
        "null"
    );

    var langClasses = (
        "Map|RegList"
    );

    // TODO var importClasses = "";

    var keywordMapper = this.createKeywordMapper({
        "variable.language": "this",
        "keyword": keywords,
        "support.function": langClasses,
        "constant.language": buildinConstants
    }, "identifier");

    this.$rules = {
        "start" : [
            {
                token : "comment",
                regex : "\\/\\/.*$"
            },
            DocCommentHighlightRules.getStartRule("doc-start"),
            {
                token : "comment", // multi line comment
                regex : "\\/\\*",
                next : "comment"
            }, {
                token : "string", // single line
                regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
            }, {
                token : "string", // single line
                regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
            }, {
                token : "constant.numeric",
                regex : "[0-9a-fA-F]+\\b"
            }, {
                token : "constant.language.boolean",
                regex : "(?:true|false)\\b"
            }, {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            }, {
                token : "keyword.operator",
                regex : "!|%|&|\\*|\\-|\\+|~|==|=|!=|<=|>=|<|>|&&|\\|\\|"
            }, {
                token : "lparen",
                regex : "[[({]"
            }, {
                token : "rparen",
                regex : "[\\])}]"
            }, {
                token : "text",
                regex : "\\s+"
            }
        ],
        "comment" : [
            {
                token : "comment", // closing comment
                regex : "\\*\\/",
                next : "start"
            }, {
                defaultToken : "comment"
            }
        ]
    };

    this.embedRules(DocCommentHighlightRules, "doc-",
        [ DocCommentHighlightRules.getEndRule("start") ]);
};

oop.inherits(FeniaHighlightRules, TextHighlightRules);

exports.FeniaHighlightRules = FeniaHighlightRules;
});
