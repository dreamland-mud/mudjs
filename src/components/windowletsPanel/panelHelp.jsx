import $ from 'jquery';
import React, { useState, useEffect, useRef } from 'react';

import { send } from '../../websock';
import { usePrompt } from '../../react-hooks';
import { t } from '../../i18n';

const echo = txt => {
  $('.terminal').trigger('output', [txt]);
};

const useTypeahead = () => {
  const [state, setState] = useState({
    loading: true,
    topics: [],
    error: null,
  });

  useEffect(() => {
    $.get('/help/typeahead.json', undefined, 'json')
      .then(data => {
        // Success:
        console.log('Retrieved', data.length, 'help topics.');

        // Convert retrieved JSON to format accepted by autocomplete plugin.
        const topics = $.map(data, dataItem => ({
          value: dataItem.n.toLowerCase(),
          data: { link: dataItem.l, title: dataItem.t, id: dataItem.id },
        }));

        setState({ loading: false, topics, error: null });
      })
      .catch(e => {
        // Failure:
        console.log('Cannot retrieve help hints.');

        setState({ loading: false, topics: [], error: e });
      });
  }, []);

  return state;
};

export default function Help() {
  const ref = useRef();
  const { loading, topics, error } = useTypeahead();
  // Subscribe to the prompt so a `config language` switch re-renders the labels.
  // t() falls back to the last-known language when a delta prompt omits lang.
  const prompt = usePrompt();
  const lang = prompt && prompt.lang;

  const showTopic = function (topic) {
    const inputbox = $(ref.current);
    var cmd = 'справка ' + topic;
    echo(cmd + '\n');
    send(cmd);
    inputbox.val('');
    $('#input input').focus();
  };

  // TODO: use React autocomplete
  useEffect(() => {
    const inputbox = $(ref.current);

    if (error) {
      // Default to just invoke 'help topic' on Enter.
      inputbox.on('keypress', function (e) {
        if (e.keyCode === 13) {
          showTopic($(this).val());
        }
      });
    } else {
      // Initialize autocomplete drop-down.
      inputbox.autocomplete({
        lookup: topics,
        lookupLimit: 10,
        autoSelectFirst: true,
        showNoSuggestionNotice: true,
        noSuggestionNotice: t('help.notFound', lang),
        formatResult: function (suggestion, currentValue) {
          let s = {};
          s.data = suggestion.data;
          s.value = '[' + currentValue + '] ' + suggestion.data.title;
          return $.Autocomplete.defaults.formatResult(s, currentValue);
        },
        onSelect: suggestion => showTopic(suggestion.data.id),
      });
    }

    return () => inputbox.off();
  }, [loading, topics, error, lang]);

  return (
    <div id="help" className="table-wrapper">
      <span
        className="dark-panel-title"
        data-toggle="collapse"
        data-target="#help-table"
      >
        {t('help.title', lang)}
      </span>
      <button
        className="close"
        type="button"
        data-toggle="collapse"
        data-target="#help-table"
      >
        {' '}
      </button>
      <div id="help-table" className="" data-hint="hint-help">
        <span className="fa fa-search form-control-feedback"></span>
        <input
          ref={ref}
          type="text"
          className="form-control"
          placeholder={t('help.placeholder', lang)}
          disabled={loading}
        />
      </div>
    </div>
  );
}
