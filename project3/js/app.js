/*
  app.js - Behavior for MT6D Monitor
  CS 5774 Project 3: Interactive Prototype
  Author: Warren Lucero

  Linked from every page after jQuery. Each feature checks that its elements
  exist before running, so one script serves the whole site.

  Features
    1. Form guard      Keeps Save / Submit buttons disabled until every
                       required field is filled in (add, detail, index pages).
    2. Simulated search Reads the keyphrase submitted by the header search
                       form and shows results or a friendly message
                       (search.html).
    3. Status actions  Click interaction using event delegation: the detail
                       page action buttons update the alert's status badge,
                       add a confirmation message, and add a new row to the
                       address-mutation history on reassignment (detail.html).
    4. Analyst notes   Submit interaction using DOM traversal: saving a note
                       adds it to the Previous notes list and updates the
                       count in the list heading (detail.html).
*/
(function ($) {
  'use strict';

  /* ------------------------------------------------------------------------
     Shared data and helpers
     ------------------------------------------------------------------------ */

  // Simulated alert records. In a real system these would come from the
  // server; here the search page filters this list.
  var ALERTS = [
    { id: 1042, device: 'PLC-07', pattern: 'Scanning / reconnaissance', detected: '3 min ago',
      datetime: '2026-09-24T13:59-04:00', confidence: 89, severity: 'high', status: 'new' },
    { id: 1035, device: 'PLC-07', pattern: 'Scanning / reconnaissance', detected: '5 hr ago',
      datetime: '2026-09-24T09:02-04:00', confidence: 78, severity: 'medium', status: 'confirmed-positive' },
    { id: 1021, device: 'PLC-07', pattern: 'Volume spike', detected: '2 days ago',
      datetime: '2026-09-22T10:15-04:00', confidence: 41, severity: 'low', status: 'false-positive' },
    { id: 1041, device: 'HMI-03', pattern: 'Traffic profiling', detected: '20 min ago',
      datetime: '2026-09-24T13:42-04:00', confidence: 61, severity: 'medium', status: 'investigating' }
  ];

  // Display text for each status and severity value used in the markup.
  var STATUS_LABELS = {
    'new': 'New',
    'investigating': 'Investigating',
    'confirmed-positive': 'Confirmed Positive',
    'false-positive': 'False Positive'
  };
  var SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

  /** Pads a number to two digits, e.g. 7 -> "07". */
  function pad2(number) {
    return (number < 10 ? '0' : '') + number;
  }

  /** Returns the current local time as "HH:MM" for display. */
  function displayTime(date) {
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  /** Returns the current local time as "HH:MM:SS" for display. */
  function displayTimeWithSeconds(date) {
    return displayTime(date) + ':' + pad2(date.getSeconds());
  }

  /** Returns a machine-readable value for a <time datetime=""> attribute. */
  function isoDateTime(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) +
      'T' + pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds());
  }

  /** Returns a random 1 to 4 digit hexadecimal group for an IPv6 address. */
  function randomHexGroup() {
    return Math.floor(Math.random() * 0x10000).toString(16);
  }


  /* ------------------------------------------------------------------------
     1. Form guard
     Any <form data-guard> keeps its submit button disabled until every
     [required] field has a non-blank, valid value. The buttons start enabled
     in the HTML, so the forms still work if JavaScript is off.
     ------------------------------------------------------------------------ */
  function initFormGuards() {
    $('form[data-guard]').each(function () {
      var $form = $(this);
      var $submitButton = $form.find('button[type="submit"]');

      function updateSubmitButton() {
        var allFilled = true;
        $form.find('[required]').each(function () {
          // Whitespace-only text does not count; checkValidity() also covers
          // email format and radio groups with nothing selected.
          if (String(this.value).trim() === '' || !this.checkValidity()) {
            allFilled = false;
            return false; // stop the .each() loop early
          }
        });
        $submitButton.prop('disabled', !allFilled);
      }

      $form.on('input change', updateSubmitButton);
      // After a reset, wait for the fields to clear before re-checking.
      $form.on('reset', function () {
        window.setTimeout(updateSubmitButton, 0);
      });

      updateSubmitButton();
    });
  }


  /* ------------------------------------------------------------------------
     2. Simulated search (search.html)
     The header search form submits with GET, so the keyphrase arrives in the
     URL as ?q=... . A switch statement decides between the simulated results
     and the friendly message. Nothing is actually searched.
     ------------------------------------------------------------------------ */
  function initSimulatedSearch() {
    var $results = $('#search-results');
    if (!$results.length) {
      return; // not on the search page
    }

    var params = new URLSearchParams(window.location.search);
    var query = (params.get('q') || '').trim();
    var $summary = $('#search-summary');

    // Echo the phrase back into both search boxes so it can be edited.
    $('#site-search, #search-again').val(query);

    // Normalize so "PLC-07", "plc07" and " plc 07 " all count as the keyphrase.
    var keyphrase = query.toLowerCase().replace(/\s+/g, ' ');

    switch (keyphrase) {
      case 'plc-07':
      case 'plc07':
      case 'plc 07':
        showSearchResults(query, ALERTS.filter(function (alert) {
          return alert.device === 'PLC-07';
        }));
        break;

      case '':
        // Nothing typed: keep the default prompt in the summary line.
        $summary.text('Type a device name or alert ID above, for example PLC-07.');
        break;

      default:
        showNoResults(query);
    }

    /** Builds one table row per alert and reveals the results section. */
    function showSearchResults(phrase, matches) {
      var $rowContainer = $('#result-rows').empty();

      $.each(matches, function (index, alert) {
        $rowContainer.append(buildAlertRow(alert));
      });

      // .text() inserts the user's phrase as plain text, never as HTML.
      $summary.text(matches.length + ' alerts found for “' + phrase + '”.');
      $results.prop('hidden', false);
    }

    /** Fills in the friendly message and reveals it. */
    function showNoResults(phrase) {
      $('#no-results-message').text(
        'We couldn’t find any alerts matching “' + phrase + '”. ' +
        'Try searching for PLC-07 to see an example.'
      );
      $summary.text('No alerts found for “' + phrase + '”.');
      $('#no-results').prop('hidden', false);
    }
  }

  /**
   * Returns a jQuery <tr> for one alert. Every row uses the same structure and
   * classes as the rows on list.html; only the content changes.
   */
  function buildAlertRow(alert) {
    var detailUrl = 'detail.html?id=' + alert.id;

    return $('<tr>').append(
      $('<th>', { scope: 'row', 'class': 'alert-id', text: '#' + alert.id }),
      $('<td>', { text: alert.device }),
      $('<td>', { 'class': 'col-optional', text: alert.pattern }),
      $('<td>').append($('<time>', { datetime: alert.datetime, text: alert.detected })),
      $('<td>', { 'class': 'num col-optional', text: alert.confidence + '%' }),
      $('<td>', { 'class': 'col-optional' }).append(
        $('<span>', { 'class': 'severity', 'data-severity': alert.severity, text: SEVERITY_LABELS[alert.severity] })
      ),
      $('<td>').append(
        $('<span>', { 'class': 'status', 'data-status': alert.status, text: STATUS_LABELS[alert.status] })
      ),
      $('<td>').append(
        $('<a>', { href: detailUrl, text: 'View' }).append(
          $('<span>', { 'class': 'visually-hidden', text: ' alert #' + alert.id })
        )
      )
    );
  }


  /* ------------------------------------------------------------------------
     3. Status actions (detail.html), interaction 1
     Event type: click. Event delegation: one handler on the .alert-actions
     container handles all three buttons, using each button's data-action.
     Modifies existing elements: the summary status badge and the buttons'
     disabled state. Adds new elements: a confirmation message below the page
     heading and, for reassignment, a new row in the mutation history table.
     ------------------------------------------------------------------------ */
  function initStatusActions() {
    var $actions = $('.alert-actions');
    if (!$actions.length) {
      return; // not on the detail page
    }

    $actions.on('click', 'button[data-action]', function (event) {
      event.preventDefault(); // stay on the page instead of submitting the form

      var $button = $(this);
      var action = $button.data('action');
      var now = new Date();

      if (action === 'reassign') {
        var newAddress = reassignAddress(now);
        showActionMessage('IP address reassigned at ' + displayTime(now) +
          '. PLC-07 now uses ' + newAddress + '.');
      } else {
        var label = STATUS_LABELS[action];

        // Modify the existing status badge in the summary.
        $('#alert-status').attr('data-status', action).text(label);

        // The chosen status button is disabled; the other status button is
        // re-enabled so the analyst can change their mind.
        $button.prop('disabled', true)
          .siblings('button[data-action]').not('[data-action="reassign"]').prop('disabled', false);

        showActionMessage('Status changed to ' + label + ' at ' + displayTime(now) + '.');
      }
    });

    /**
     * Adds a new row to the top of the mutation history. The previous address
     * is read from the current newest row so the history stays connected.
     * Returns the newly generated address.
     */
    function reassignAddress(now) {
      var $tableBody = $('#mutation-rows');
      var currentAddress = $tableBody.children('tr').first().children('td').last().text();
      var newAddress = '2001:db8:85a3::' + [randomHexGroup(), randomHexGroup(),
        randomHexGroup(), randomHexGroup()].join(':');

      var $newRow = $('<tr>', { 'class': 'is-new' }).append(
        $('<td>').append($('<time>', { datetime: isoDateTime(now), text: displayTimeWithSeconds(now) })),
        $('<td>', { text: currentAddress }),
        $('<td>', { text: newAddress })
      );

      $tableBody.prepend($newRow);
      return newAddress;
    }

    /**
     * Shows a confirmation message under the page heading. Any earlier
     * message is removed first so only the latest one is shown.
     */
    function showActionMessage(message) {
      $('.action-message').remove();
      $('<p>', { 'class': 'action-message', role: 'status', text: message })
        .insertAfter('.page-head');
    }
  }


  /* ------------------------------------------------------------------------
     4. Analyst notes (detail.html), interaction 2
     Event type: submit. DOM traversal: from the form, closest() climbs to its
     panel, then find() and children() reach the note list, its first note
     (used as a template), and the list heading.
     Adds a new element: the saved note at the top of the list.
     Modifies existing elements: the "Previous notes (n)" heading count and
     the cleared note box.
     ------------------------------------------------------------------------ */
  function initAnalystNotes() {
    var $noteForm = $('#note-form');
    if (!$noteForm.length) {
      return; // not on the detail page
    }

    $noteForm.on('submit', function (event) {
      event.preventDefault(); // no backend yet, so keep the note on this page

      var $form = $(this);
      var $noteBox = $form.find('textarea');
      var noteText = String($noteBox.val()).trim();
      if (noteText === '') {
        return; // the form guard normally prevents this
      }

      // Traverse from the form to the related parts of the same panel.
      var $panel = $form.closest('.panel');
      var $noteList = $panel.find('.note-list');
      var $listHeading = $panel.find('h3').first();
      var now = new Date();

      // Copy an existing note so the new one has identical markup, then
      // replace its content. .text() keeps the analyst's note as plain text.
      var $newNote = $noteList.children('li').first().clone();
      $newNote.find('.analyst-note-author').text('W. Lucero');
      $newNote.find('.analyst-note-role').text('Analyst (you)');
      $newNote.find('time').attr('datetime', isoDateTime(now)).text(displayTime(now));
      $newNote.find('p').text(noteText);
      $newNote.children('.analyst-note').addClass('is-new');

      $noteList.prepend($newNote);

      // Update the count and reset the form (the guard disables Save Note again).
      $listHeading.text('Previous notes (' + $noteList.children('li').length + ')');
      $noteBox.val('').trigger('input');
    });
  }


  /* ------------------------------------------------------------------------
     Start everything once the page has loaded
     ------------------------------------------------------------------------ */
  $(function () {
    initFormGuards();
    initSimulatedSearch();
    initStatusActions();
    initAnalystNotes();
  });
})(jQuery);
