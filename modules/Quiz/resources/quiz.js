/**
 * Created by mark.feder Kaltura.
 * V2.39.quiz-rc4
 */
(function (mw, $) {
    "use strict";
    $.cpObject = {};
    $.quizParams = {};
    mw.PluginManager.add('quiz', mw.KBaseScreen.extend({
        defaultConfig: {
            parent: "controlsContainer",
            order: 5,
            align: "right",
            tooltip: gM('mwe-quiz-tooltip'),
            visible: false,
            showTooltip: true,
            displayImportance: 'medium',
            templatePath: '../Quiz/resources/templates/quiz.tmpl.html',
            usePreviewPlayer: false,
            previewPlayerEnabled: false
        },
        entryData: null,
        reviewMode: false,
        showCorrectKeyOnAnswer: false,
        showResultOnAnswer: false,
        isSeekingIVQ:false,
        inFullScreen : false,
        selectedAnswer:null,

        setup: function () {
            var _this = this;
            var embedPlayer = this.getPlayer();

            _this.KIVQModule = new mw.KIVQModule(embedPlayer,_this);
            _this.KIVQModule.setupQuiz(embedPlayer);
            _this.KIVQScreenTemplate = new mw.KIVQScreenTemplate(embedPlayer);

            this.addBindings();
        },
        addBindings: function () {
            var _this = this;
            var embedPlayer = this.getPlayer();

            this.bind('layoutBuildDone', function () {
                var entryRequest = {
                    'service': 'baseEntry',
                    'action': 'get',
                    'entryId': embedPlayer.kentryid
                };
                _this.getKClient().doRequest(entryRequest, function (data) {
                    if (!_this.KIVQModule.checkApiResponse('Get baseEntry err -->',data)){
                        return false;
                    }
                    _this.entryData = data;
                });
            });

            this.bind('KalturaSupport_CuePointReached', function (e, cuePointObj) {
                if(!_this.isSeekingIVQ){
                    _this.KIVQModule.cuePointReachedHandler(e, cuePointObj)
                }
                if(_this.enablePlayDuringScreen) {
                    _this.enablePlayDuringScreen = false;
                }
            });

            this.bind('prePlayAction', function (e, data) {

                if(_this.getPlayer().firstPlay && !_this.firstPlay){
                    data.allowPlayback = false;
                    _this.firstPlay = true;
                    _this.enablePlayDuringScreen = false;
                    _this.KIVQModule.checkQKDPReady(function(){
                        _this.ssWelcome();
                        _this.unbind('prePlayAction');
                    });
                };
            });

            this.bind('seeked', function () {
                setTimeout(function () {
                    _this.isSeekingIVQ = false;}, 0);
            });
            this.bind('seeking', function () {
                _this.isSeekingIVQ = true;
            });

            embedPlayer.addJsListener( 'kdpReady', function(){
                _this.KIVQModule.isQKDPReady = true;
                if (embedPlayer.autoplay) {
                    embedPlayer.autoplay = false;
                }
                embedPlayer.removeJsListener( 'kdpReady');

            });
            embedPlayer.addJsListener( 'playerPlayEnd', function(){
                _this.KIVQModule.quizEndScenario();
            });

            embedPlayer.bindHelper('onOpenFullScreen', function() {
                _this.inFullScreen = true;
                if (!_this.isScreenVisible()) {
                    _this.KIVQModule.showQuizOnScrubber();
                }
            });
            embedPlayer.bindHelper('onCloseFullScreen', function() {
                _this.inFullScreen = false;
                if (!_this.isScreenVisible()) {
                    _this.KIVQModule.showQuizOnScrubber();
                }
            });
            this.bind( 'preShowScreen', function( event, screenName ){
                if ( !embedPlayer.isInSequence() ){
                    embedPlayer.disablePlayControls();
                    embedPlayer.triggerHelper( 'onDisableKeyboardBinding');
                }
                _this.KIVQModule.hideQuizOnScrubber();
            });
            this.bind( 'preHideScreen', function( event, screenName ){
                if (screenName != 'quiz'){
                    _this.KIVQModule.showQuizOnScrubber();
                }
            });
            this.bind('hideScreen', function(event, screenName){
                if(screenName === 'quiz'){
                    if (!_this.embedPlayer._playContorls){
                        _this.KIVQModule.showQuizOnScrubber();
                        embedPlayer.enablePlayControls();
                        embedPlayer.play();
                    };
                }
            });
            this.bind('onChangeMediaDone', function(){
                $.cpObject = {};
                $.quizParams = {};
                _this.KIVQModule.hideQuizOnScrubber();
                _this.KIVQModule.setupQuiz(embedPlayer);
            });
        },
        getKClient: function () {
            if (!this.kClient) {
                this.kClient = mw.kApiGetPartnerClient(this.embedPlayer.kwidgetid);
            }
            return this.kClient;
        },
        getTemplateHTML: function (data) {
            var defer = $.Deferred();
            var quizStartTemplate = this.getTemplatePartialHTML("quizstart");
            var $template = $(quizStartTemplate({
                'quiz': this,
                quizStartTemplate: quizStartTemplate
            }));
            return defer.resolve($template);
        },

        showScreen:function(){
            this.embedPlayer.pause();
            this._super();
        },
        ssWelcome: function () {
            var _this = this;
            _this.ivqShowScreen();
            _this.KIVQScreenTemplate.tmplWelcome();

            $(".welcome").html(gM('mwe-quiz-welcome'));
            $(".confirm-box").html(gM('mwe-quiz-plsWait'));

            _this.KIVQModule.checkCuepointsReady(function(){

                if ($.quizParams.allowDownload ) {
                    $(".pdf-download").prepend('<div class="pdf-download-img">' +
                    '</div><div class="pdf-download-txt">'
                    + gM('mwe-quiz-pdf')+'</div>');

                    $(".pdf-download-img").on('click',function(){
                        _this.KIVQModule.getIvqPDF(_this.embedPlayer.kentryid);
                        $(".pdf-download-img").off();
                    });
                }
                $.grep($.quizParams.uiAttributes, function (e) {
                    switch(e.key){
                        case 'welcomeMessage':
                            $(".welcomeMessage").html(e.value);
                            break;
                        case 'inVideoTip':
                            if (e.value ==='true'){
                                $(".InvideoTipMessage").html(gM('mwe-quiz-invideoTip'));
                            }
                            break;
                    }
                });

                $(".confirm-box").html(gM('mwe-quiz-continue'))
                    .on('click', function () {
                        _this.KIVQModule.checkIfDone(-1);
                    });
            });
        },

        ssAlmostDone: function (unAnsweredArr) {
            var _this = this,embedPlayer = this.getPlayer();;

            _this.ivqShowScreen();
            _this.KIVQScreenTemplate.tmplAlmostDone();

            $(".title-text").html(gM('mwe-quiz-almostDone'));
            $(".sub-text").html(gM('mwe-quiz-remainUnAnswered') + '</br>' + gM('mwe-quiz-pressRelevatToAnswer'))
            $(".confirm-box").html(gM('mwe-quiz-okGotIt'))

            $(document).off('click','.confirm-box')
                .on('click', '.confirm-box', function () {
                    _this.embedPlayer.seek(0,true);
                    _this.KIVQModule.continuePlay();
                });
        },

        ssDisplayHint: function(questionNr){
            var _this = this;
            var embedPlayer = _this.getPlayer();
            $("<div>"+ gM('mwe-quiz-hint') +"</div>").prependTo(".header-container").addClass('hint-why-box')
                .on('click', function () {
                    _this.KIVQScreenTemplate.tmplHint();
                    $(".header-container").addClass('close-button')
                        .on('click', function () {
                            _this.ssSetCurrentQuestion(questionNr,true);
                        });
                    $(".hint-container").append($.cpObject.cpArray[questionNr].hintText);
                })
        },
        ssDisplayWhy: function (questionNr) {
            var _this = this;
            $("<div>"+ gM('mwe-quiz-why') +"</div>").prependTo(".header-container").addClass('hint-why-box')
                .on('click', function () {
                    _this.KIVQScreenTemplate.tmplWhy();
                    $(".header-container").addClass('close-button')
                        .on('click', function () {
                            _this.KIVQScreenTemplate.tmplReviewAnswer();
                            _this.ssReviewAnswer(questionNr);
                        });
                    $(".hint-container").append($.cpObject.cpArray[questionNr].explanation);
                })
        },
        ssSetCurrentQuestion: function (questionNr,replaceContentNoReload) {
            var _this = this,cPo = $.cpObject.cpArray[questionNr];

            _this.ivqShowScreen();
            _this.KIVQScreenTemplate.tmplQuestion();

            if ($.cpObject.cpArray[questionNr].hintText){
                _this.ssDisplayHint(questionNr)
            }

            if (cPo.question.length < 68){
                $(".display-question").addClass("padding7");
            }
            $(".display-question").text(cPo.question);
            $.each(cPo.answeres, function (key, value) {
                var div= $("<div class ='single-answer-box-bk'>"
                + "<div class ='single-answer-box-txt' id="
                + key + "><p></p></div></div>");
                div.find('p').text(value);
                div.appendTo('.answers-container');
            });

            if (cPo.isAnswerd){
                _this.showAnswered(cPo, questionNr);
            }
            else {
                _this._selectAnswerConroller(cPo, questionNr);
            }
            this.addFooter(questionNr);
        },
        ssAllCompleted: function () {
            var _this = this;
            _this.reviewMode = true;
            _this.ivqShowScreen();
            _this.KIVQScreenTemplate.tmplAllCompleted();

            $(".title-text").html(gM('mwe-quiz-completed'));
            $(".sub-text").html(gM('mwe-quiz-TakeAMoment') + '<strong> '+ gM('mwe-quiz-review').toLowerCase() +' </strong>'
                + gM('mwe-quiz-yourAnswers') + '</br><strong> '+ gM('mwe-quiz-or') +' </strong>'
                + gM('mwe-quiz-goAhead')+ '<strong> '+ gM('mwe-quiz-submit').toLowerCase() +' </strong>'
            );

            $(".review-button").html(gM('mwe-quiz-review'))
                .on('click', function () {
                    _this.embedPlayer.seek(0,true);
                    _this.KIVQModule.continuePlay();
                });

            $(".submit-button").html(gM('mwe-quiz-submit'))
                .on('click', function () {
                    $(this).off('click');
                    $(this).html(gM('mwe-quiz-plsWait'));
                    _this.KIVQModule.setSubmitQuiz();
                });
        },
        ssSubmitted: function (score) {
            var _this = this,cpArray = $.cpObject.cpArray;
            _this.ivqShowScreen();
            _this.KIVQScreenTemplate.tmplSubmitted();

            $(".title-text").html(gM('mwe-quiz-Submitted'));

            if ($.quizParams.showGradeAfterSubmission){
                if (!$.quizParams.showCorrectAfterSubmission) {
                    $(".title-text").addClass("padding23");
                    $(".sub-text").html(gM('mwe-quiz-completedScore')
                    + '<span class="scoreBig">' + score + '</span>' + ' %');
                    $(".bottomContainer").addClass("paddingB20");
                } else {
                    if(cpArray.length <= 6){
                        $(".title-text").addClass("padding14");
                    }
                    $(".sub-text").html(gM('mwe-quiz-completedScore')
                    + '<span class="scoreBig">' + score + '</span>' + ' %' + '</br>'
                    + gM('mwe-quiz-reviewSubmit'));

                    _this.KIVQModule.displayHex(_this.KIVQModule.setHexContainerPos("current"),cpArray);

                    $(document).off('click','.q-box')
                        .on('click', '.q-box', function () {
                            _this.KIVQScreenTemplate.tmplReviewAnswer();
                            _this.ssReviewAnswer(parseInt($(this).attr('id')));
                        });
                    $(document).off('click','.q-box-false')
                        .on('click', '.q-box-false', function () {
                            _this.KIVQScreenTemplate.tmplReviewAnswer();
                            _this.ssReviewAnswer(parseInt($(this).attr('id')));
                        });
                }
            }else{
                $(".title-text").addClass("padding23");
                $(".sub-text").html(gM('mwe-quiz-completedQuiz'));
                $(".bottomContainer").addClass("paddingB20");
            }
            $(document).off('click','.confirm-box')
            $(".confirm-box").html(gM('mwe-quiz-done'))
                .on('click', function () {
                    if (mw.isMobileDevice() || _this.embedPlayer.getPlayerElementTime() === 0 ){
                        _this.KIVQModule.continuePlay();
                    }else {
                        _this.KIVQScreenTemplate.tmplThankYou();
                        $(".title-text").html(gM('mwe-quiz-thankYou'));
                        $(this).delay(1000).fadeIn(function () {
                            _this.KIVQModule.quizEndFlow = false;
                            if (_this.embedPlayer.getPlayerElementTime() > 0) {
                                _this.ivqHideScreen();
                                _this.embedPlayer.seek(0, false);
                            }
                            _this.KIVQModule.continuePlay();
                        });
                    }
                });
        },
        ssReviewAnswer: function (selectedQuestion) {
            var _this = this;

            if ($.cpObject.cpArray[selectedQuestion].explanation ){
                _this.ssDisplayWhy(selectedQuestion)
            }
            $(".reviewAnswerNr").append(_this.KIVQModule.i2q(selectedQuestion));
            //$(".theQuestion").html(gM('mwe-quiz-q') + "  " + $.cpObject.cpArray[selectedQuestion].question);
            $(".theQuestion").html($.cpObject.cpArray[selectedQuestion].question);
            $(".yourAnswerText").html(gM('mwe-quiz-yourAnswer'));
            $(".yourAnswer").html($.cpObject.cpArray[selectedQuestion].answeres[$.cpObject.cpArray[selectedQuestion].selectedAnswer]);
            if (!$.cpObject.cpArray[selectedQuestion].isCorrect) {
                $(".yourAnswer").addClass("wrongAnswer")
            }
            $(".correctAnswerText").html(gM('mwe-quiz-correctAnswer'));

            $(".correctAnswer").html(function () {
                if (!$.isEmptyObject($.cpObject.cpArray[selectedQuestion].correctAnswerKeys)) {

                    return $.cpObject.cpArray[selectedQuestion]
                        .answeres[
                        _this.KIVQModule.q2i($.cpObject.cpArray[selectedQuestion].correctAnswerKeys[0].value)
                        ];
                }
                else {return " "}
            });
            $('.gotItBox').html(gM('mwe-quiz-gotIt')).bind('click', function () {
                _this.ssSubmitted(_this.KIVQModule.score);
            });
        },
        showSelectedQuestion:function(questionNr){
            var _this = this;
            $('.single-answer-box-txt#'+_this.selectedAnswer +'')
                .parent().addClass("wide")
                .addClass('single-answer-box-bk-apply')
                .children().removeClass('single-answer-box-txt')
                .addClass(function(){
                    $(this).addClass('single-answer-box-txt-wide')
                        .after($('<div></div>')
                            .addClass("single-answer-box-apply qContinue")
                            .text(gM('mwe-quiz-continue'))
                    )
                });
        },
        showAnswered: function (cPo, questionNr) {
            var _this = this;
            $.each(cPo.answeres, function (key, value) {
                if (key == $.cpObject.cpArray[questionNr].selectedAnswer) {
                    $('#' + key).parent().addClass("wide single-answer-box-bk-apply disable");
                    $('#' + key).removeClass('single-answer-box-txt')
                        .addClass(function(){
                            $(this).addClass('single-answer-box-txt-wide ')
                                .after($('<div></div>')
                                .addClass("single-answer-box-apply qApplied disable")
                                .text(gM('mwe-quiz-applied'))
                            )
                        });
                }
            });
            if ($.quizParams.allowAnswerUpdate ) {
                _this._selectAnswerConroller(cPo, questionNr);
            }
        },
        _selectAnswerConroller: function (cPo, questionNr) {
            var _this = this;
            if (_this.KIVQModule.quizSubmitted) return;

            if (_this.selectedAnswer &&! cPo.selectedAnswer ){
                _this.showSelectedQuestion(questionNr);
            };

           $('.single-answer-box-bk').off().on('click',function(e){

                if ($(this).hasClass('disable')) return false;

                if (e.target.className === 'single-answer-box-apply qContinue' ){
                    e.stopPropagation();
                    $('.single-answer-box-bk').addClass('disable');
                            $('.single-answer-box-apply').fadeOut(100,function(){
                                $(this).addClass('disable')
                                    .removeClass('qContinue')
                                    .text(gM('mwe-quiz-applied'))
                                    .addClass('qApplied').fadeIn(100);
                            });
                    _this.KIVQModule.submitAnswer(questionNr,_this.selectedAnswer);
                    _this.selectedAnswer = null;
                    setTimeout(function(){_this.KIVQModule.checkIfDone(questionNr)},1800);
                }
               else{
                    $('.answers-container').find('.disable').removeClass('disable');
                    $('.single-answer-box-bk').each(function () {
                        $(this).removeClass('wide single-answer-box-bk-apply single-answer-box-bk-applied');
                        $('.single-answer-box-apply').empty().remove();
                        $(this).children().removeClass('single-answer-box-txt-wide').addClass('single-answer-box-txt');
                    });

                    $(this).addClass("wide")
                        .addClass('single-answer-box-bk-apply')
                        .children().removeClass('single-answer-box-txt')
                        .addClass(function(){
                            $(this).addClass('single-answer-box-txt-wide')
                                .after($('<div></div>')
                                    .addClass("single-answer-box-apply qContinue")
                                    .text(gM('mwe-quiz-continue'))
                            )
                        });
                    _this.selectedAnswer =  $('.single-answer-box-txt-wide').attr('id');
               }
           });
        },
        ivqShowScreen:function(){
            var _this = this,embedPlayer = this.getPlayer();
            _this.showScreen();
        },
        ivqHideScreen:function(){
            var _this = this,embedPlayer = this.getPlayer();

            embedPlayer.getInterface().find('.ivqContainer').empty().remove();
            _this.hideScreen();
            _this.embedPlayer.enablePlayControls();
            _this.embedPlayer.triggerHelper( 'onEnableKeyboardBinding' );
            _this.KIVQModule.showQuizOnScrubber();
        },
        addFooter: function (questionNr) {
            var _this = this;

            if (_this.KIVQModule.quizSubmitted) {
                $(".ftr-right").html(gM('mwe-quiz-next')).on('click', function () {
                    _this.KIVQModule.continuePlay();
                });
                return;
            }
            if (_this.reviewMode) {
                $(".ftr-left").append ($('<span>   ' +  gM('mwe-quiz-review').toUpperCase()
                + ' ' + gM('mwe-quiz-question') + ' ' + this.KIVQModule.i2q(questionNr)
                + '/' + $.cpObject.cpArray.length + '</span>'));

                $(".ftr-right").html(gM('mwe-quiz-next')).on('click', function () {
                    _this.KIVQModule.continuePlay();
                });
            } else {
                $(".ftr-left").append($('<span> ' + gM('mwe-quiz-question') + ' ' + this.KIVQModule.i2q(questionNr)
                + '/' + $.cpObject.cpArray.length + '</span>')
                    .css("float", "right")
                    .css("cursor","default"))
                    .append($('<div></div>')
                        .addClass("pie")
                        .css("float", "right"))
                    .append($('<span>' + (_this.KIVQModule.getUnansweredQuestNrs()).length + ' '
                    + gM('mwe-quiz-unanswered') + '</span>')
                        .css("float", "right")
                        .css("cursor","default"));
                if (_this.KIVQModule.canSkip) {
                    $(".ftr-right").html(gM('mwe-quiz-skipForNow')).on('click', function () {
                        _this.KIVQModule.checkIfDone(questionNr)
                    });
                }else if(!_this.KIVQModule.canSkip && $.cpObject.cpArray[questionNr].isAnswerd ){
                    $(".ftr-right").html(gM('mwe-quiz-next')).on('click', function () {
                        _this.KIVQModule.checkIfDone(questionNr)
                    });
                }
            }
        },
        displayBubbles:function(){
            var  _this = this,displayClass,embedPlayer = this.getPlayer(),handleBubbleclick;
            var scrubber = embedPlayer.getInterface().find(".scrubber");
            var buSize = _this.KIVQModule.bubbleSizeSelector(_this.inFullScreen);

            _this.KIVQModule.hideQuizOnScrubber();

            var buCotainerPos = _this.KIVQModule.quizEndFlow ? "bubble-cont bu-margin3":"bubble-cont bu-margin1";

            scrubber.parent().prepend('<div class="'+buCotainerPos+'"></div>');

            $.each($.cpObject.cpArray, function (key, val) {
                displayClass = val.isAnswerd ? "bubble bubble-ans " + buSize.bubbleAnsSize
                    : "bubble bubble-un-ans " + buSize.bubbleUnAnsSize;
                var pos = (Math.round(((val.startTime/_this.entryData.msDuration)*100) * 10)/10)-1;
                $('.bubble-cont').append($('<div id ="' + key + '" style="margin-left:' + pos + '%">' +
                    _this.KIVQModule.i2q(key) + ' </div>')
                        .addClass(displayClass)
                );
            });

            if (_this.KIVQModule.canSkip) {
                handleBubbleclick = '.bubble';
            }
            else{
                handleBubbleclick = '.bubble-ans';
            }
            $('.bubble','.bubble-ans','.bubble-un-ans').off();
            $(handleBubbleclick).on('click', function () {
                _this.unbind('seeking');
                _this.KIVQModule.gotoScrubberPos(parseInt($(this).attr('id')));
                _this.bind('seeking', function () {
                    _this.isSeekingIVQ = true;
                });
            });
        },
        displayQuizEnd:function(){
            var  _this = this;
            var scrubber = this.embedPlayer.getInterface().find(".scrubber");

            scrubber.parent().prepend('<div class="quizDone-cont"></div>');

            $(document).off( 'click', '.quizDone-cont' )
                .on('click', '.quizDone-cont', function () {
                    _this.KIVQModule.quizEndScenario();
                });
        }
    }));
})(window.mw, window.jQuery);
