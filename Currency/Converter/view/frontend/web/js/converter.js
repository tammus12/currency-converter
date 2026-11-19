define([
    'jquery'
], function ($) {
    'use strict';

    return function (config, element) {

        var $root = $(element);
        var apiUrl = $root.data('api-url');

        var $from = $('#from-currency');
        var $to = $('#to-currency');
        var $amount = $('#from-amount');
        var $converted = $('#to-amount');

        var $rate = $('#exchange-rate');
        var $rateDate = $('#rate-date');

        var canvas = document.getElementById('exchange-chart');
        var context = canvas.getContext('2d');

        var currentRate = 0;
        var requestNumber = 0;

        function apiRequest(params) {
            return $.ajax({
                url: apiUrl,
                method: 'GET',
                dataType: 'json',
                data: params
            });
        }

        function showError(message) {
            $('#conversion-message')
                .text(message)
                .addClass('error');
        }

        function clearError() {
            $('#conversion-message')
                .text('')
                .removeClass('error');
        }

        function formatAmount(value) {
            return Number(value).toLocaleString(
                undefined,
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6
                }
            );
        }

        function loadCurrencies() {
           
        return apiRequest({
            action: 'currencies'
        }).done(function (response) {

        if (!response.success || !Array.isArray(response.data)) {
            showError('Unable to load currencies.');
            return;
        }

        $from.empty();
        $to.empty();

        response.data.forEach(function (currency) {

            var code = currency.iso_code;
            console.log(code);
            var name = currency.name;

            if (!code || !name) {
                console.warn('Invalid currency object:', currency);
                return;
            }

            var option = $('<option></option>')
                .val(code)
                .text(code + ' - ' + name);

            $from.append(option.clone());
            $to.append(option.clone());

        });

        $from.val('USD');
        $to.val('EUR');

        convertCurrency();

        }).fail(function (xhr) {

        console.error('Currency API error:', xhr.responseText);

        showError('Unable to load available currencies.');

        });
    }
        function convertCurrency() {

            var base = $from.val();
            var quote = $to.val();

            var amount = parseFloat($amount.val());

            var thisRequest = ++requestNumber;

            clearError();

            if (!base || !quote) {
                return;
            }

            if (!Number.isFinite(amount) || amount < 0) {
                $converted.val('');
                showError('Please enter a valid amount.');
                return;
            }

            if (base === quote) {

                currentRate = 1;

                $converted.val(formatAmount(amount));

                $rate.text('1 ' + base + ' = 1 ' + quote);

                $rateDate.text('Identical currencies');

                loadHistory();

                return;
            }

            $rate.text('Loading exchange rate...');

            apiRequest({
                action: 'rate',
                base: base,
                quote: quote
            }).done(function (response) {

                if (thisRequest !== requestNumber) {
                    return;
                }

                if (!response.success || !response.data.rate) {
                    showError('Exchange rate unavailable.');
                    return;
                }

                currentRate = Number(response.data.rate);

                updateConversion(amount, base, quote);

                $rate.text(
                    '1 ' + base + ' = ' +
                    formatAmount(currentRate) + ' ' + quote
                );

                $rateDate.text(
                    'Reference date: ' + response.data.date
                );

                loadHistory();

            }).fail(function () {

                if (thisRequest === requestNumber) {
                    showError('Unable to retrieve exchange rate.');
                }

            });
        }

        function updateConversion(amount, base, quote) {

            if (!Number.isFinite(currentRate)) {
                return;
            }

            var result = amount * currentRate;

            $converted.val(formatAmount(result));

            $('#conversion-message')
                .text(
                    formatAmount(amount) + ' ' + base +
                    ' = ' + formatAmount(result) + ' ' + quote
                );
        }

        function swapCurrencies() {

            var fromValue = $from.val();
            var toValue = $to.val();

            $from.val(toValue);
            $to.val(fromValue);

            convertCurrency();
        }

        function getDateRange(days) {

            var end = new Date();
            var start = new Date();

            start.setDate(start.getDate() - days);

            function formatDate(date) {

                var year = date.getFullYear();
                var month = String(
                    date.getMonth() + 1
                ).padStart(2, '0');

                var day = String(
                    date.getDate()
                ).padStart(2, '0');

                return year + '-' + month + '-' + day;
            }

            return {
                from: formatDate(start),
                to: formatDate(end)
            };
        }

        function loadHistory() {

            var base = $from.val();
            var quote = $to.val();

            var days = parseInt(
                $('#history-period').val(),
                10
            );

            if (!base || !quote) {
                return;
            }

            $('#history-loading').text('Loading historical rates...');

            if (base === quote) {
                var range = getDateRange(days);

                drawChart(
                    [{
                        date: range.from,
                        rate: 1
                    }, {
                        date: range.to,
                        rate: 1
                    }]
                );

                $('#history-loading').text('');
                $('#history-summary').text('Rate remained 1:1.');
                return;
            }

            var historyRequest = ++requestNumber;

            var range = getDateRange(days);

            apiRequest({
                action: 'history',
                base: base,
                quote: quote,
                from: range.from,
                to: range.to
            }).done(function (response) {

                if (historyRequest !== requestNumber) {
                    return;
                }

                if (!response.success || !response.data.length) {
                    $('#history-loading').text(
                        'No historical exchange rates available.'
                    );
                    return;
                }

                var points = response.data.map(function (item) {

                    return {
                        date: item.date,
                        rate: Number(item.rate)
                    };

                }).sort(function (a, b) {

                    return a.date.localeCompare(b.date);

                });

                $('#history-loading').text('');

                drawChart(points);
                updateHistorySummary(points, base, quote);

            }).fail(function () {

                $('#history-loading').text(
                    'Unable to load historical exchange rates.'
                );

            });
        }

        function updateHistorySummary(points, base, quote) {

            if (!points.length) {
                return;
            }

            var first = points[0].rate;
            var last = points[points.length - 1].rate;

            var difference = last - first;

            var percentage = first !== 0
                ? (difference / first) * 100
                : 0;

            var direction = difference >= 0
                ? 'increased'
                : 'decreased';

            $('#history-summary').text(
                'The exchange rate ' + direction +
                ' by ' + Math.abs(percentage).toFixed(2) +
                '% over this period (' +
                base + ' / ' + quote + ').'
            );
        }

        function drawChart(points) {

            if (!points.length) {
                return;
            }

            var width = canvas.clientWidth;
            var height = 300;

            var ratio = window.devicePixelRatio || 1;

            canvas.width = width * ratio;
            canvas.height = height * ratio;

            context.setTransform(
                ratio, 0, 0, ratio, 0, 0
            );

            context.clearRect(0, 0, width, height);

            var padding = {
                top: 25,
                right: 25,
                bottom: 45,
                left: 70
            };

            var chartWidth =
                width - padding.left - padding.right;

            var chartHeight =
                height - padding.top - padding.bottom;

            var rates = points.map(function (point) {
                return point.rate;
            });

            var min = Math.min.apply(null, rates);
            var max = Math.max.apply(null, rates);

            if (min === max) {
                min -= min * 0.01 || 0.01;
                max += max * 0.01 || 0.01;
            }

            var range = max - min;

            function xPosition(index) {

                return padding.left +
                    (index / Math.max(points.length - 1, 1)) *
                    chartWidth;
            }

            function yPosition(value) {

                return padding.top +
                    ((max - value) / range) *
                    chartHeight;
            }

            // Horizontal grid lines

            context.strokeStyle = '#e8edf2';
            context.lineWidth = 1;

            context.fillStyle = '#667085';
            context.font = '11px Arial';

            for (var i = 0; i <= 4; i++) {

                var y = padding.top +
                    (chartHeight / 4) * i;

                var value = max - (range / 4) * i;

                context.beginPath();
                context.moveTo(padding.left, y);
                context.lineTo(width - padding.right, y);
                context.stroke();

                context.textAlign = 'right';

                context.fillText(
                    value.toFixed(4),
                    padding.left - 10,
                    y + 4
                );
            }

            // Exchange rate line

            context.beginPath();

            points.forEach(function (point, index) {

                var x = xPosition(index);
                var y = yPosition(point.rate);

                if (index === 0) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }

            });

            context.strokeStyle = '#2563eb';
            context.lineWidth = 2.5;
            context.stroke();

            // Gradient area

            context.lineTo(
                xPosition(points.length - 1),
                padding.top + chartHeight
            );

            context.lineTo(
                padding.left,
                padding.top + chartHeight
            );

            context.closePath();

            var gradient = context.createLinearGradient(
                0,
                padding.top,
                0,
                height
            );

            gradient.addColorStop(
                0,
                'rgba(37, 99, 235, 0.20)'
            );

            gradient.addColorStop(
                1,
                'rgba(37, 99, 235, 0.01)'
            );

            context.fillStyle = gradient;
            context.fill();

            // Date labels

            context.fillStyle = '#667085';
            context.font = '11px Arial';
            context.textAlign = 'center';

            var labelIndexes = [
                0,
                Math.floor((points.length - 1) / 2),
                points.length - 1
            ];

            labelIndexes.forEach(function (index) {

                var date = points[index].date;

                context.fillText(
                    date,
                    xPosition(index),
                    height - 12
                );

            });

        }

        // Event handlers

        $amount.on('input', function () {

            if (currentRate > 0) {
                updateConversion(
                    parseFloat($amount.val()),
                    $from.val(),
                    $to.val()
                );
            }
        });

        $from.on('change', convertCurrency);

        $to.on('change', convertCurrency);

        $('#swap-currencies').on('click', swapCurrencies);

        $('#history-period').on('change', loadHistory);

        $(window).on('resize', function () {
            loadHistory();
        });

        // Initial load

        loadCurrencies();
    };
});