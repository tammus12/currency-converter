<?php
/**
 * Copyright © Magento. All rights reserved.
 * See COPYING.txt for license details.
 */

declare(strict_types=1);

namespace Currency\Converter\Controller\Api;

use Currency\Converter\Model\Frankfurter;
use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Action\Context;
use Magento\Framework\Controller\Result\Json;
use Magento\Framework\Controller\Result\JsonFactory;

/**
 * Controller for Currency Converter API requests.
 *
 * Handles the following actions:
 * - currencies: Retrieve supported currencies.
 * - rate: Retrieve the latest exchange rate.
 * - history: Retrieve historical exchange rates.
 */
class Rates extends Action
{
    /**
     * JSON result factory.
     *
     * @var JsonFactory
     */
    private JsonFactory $resultJsonFactory;

    /**
     * Frankfurter API service.
     *
     * @var Frankfurter
     */
    private Frankfurter $frankfurter;

    /**
     * Rates constructor.
     *
     * @param Context $context
     * @param JsonFactory $resultJsonFactory
     * @param Frankfurter $frankfurter
     */
    public function __construct(
        Context $context,
        JsonFactory $resultJsonFactory,
        Frankfurter $frankfurter
    ) {
        parent::__construct($context);

        $this->resultJsonFactory = $resultJsonFactory;
        $this->frankfurter = $frankfurter;
    }

    /**
     * Execute the requested currency API action.
     *
     * @return Json
     */
    public function execute(): Json
    {
        $result = $this->resultJsonFactory->create();

        try {
            $action = (string) $this->getRequest()->getParam('action');

            switch ($action) {
                case 'currencies':
                    $data = $this->frankfurter->getCurrencies();
                    break;

                case 'rate':
                    $base = $this->getCurrency('base');
                    $quote = $this->getCurrency('quote');

                    $data = $this->frankfurter->getLatestRate(
                        $base,
                        $quote
                    );
                    break;

                case 'history':
                    $base = $this->getCurrency('base');
                    $quote = $this->getCurrency('quote');

                    $from = (string) $this->getRequest()->getParam('from');
                    $to = (string) $this->getRequest()->getParam('to');

                    $this->validateDateRange($from, $to);

                    $data = $this->frankfurter->getHistoricalRates(
                        $base,
                        $quote,
                        $from,
                        $to
                    );
                    break;

                default:
                    throw new \InvalidArgumentException(
                        __('Invalid API action.')->render()
                    );
            }

            return $result->setData([
                'success' => true,
                'data' => $data
            ]);
        } catch (\InvalidArgumentException $exception) {
            return $this->setErrorResponse(
                $result,
                $exception->getMessage(),
                400
            );
        } catch (\Throwable $exception) {
            $this->_logger->error(
                'Currency Converter API error: ' . $exception->getMessage()
            );

            return $this->setErrorResponse(
                $result,
                (string) __('Unable to retrieve exchange rates. Please try again.'),
                502
            );
        }
    }

    /**
     * Retrieve and validate a currency code from the request.
     *
     * @param string $parameter
     * @return string
     * @throws \InvalidArgumentException
     */
    private function getCurrency(string $parameter): string
    {
        $currency = strtoupper(
            trim((string) $this->getRequest()->getParam($parameter))
        );

        if (!preg_match('/^[A-Z]{3}$/', $currency)) {
            throw new \InvalidArgumentException(
                (string) __('Invalid currency code.')
            );
        }

        return $currency;
    }

    /**
     * Validate the historical date range.
     *
     * @param string $from
     * @param string $to
     * @return void
     * @throws \InvalidArgumentException
     */
    private function validateDateRange(
        string $from,
        string $to
    ): void {
        if (
            !$this->isValidDate($from) ||
            !$this->isValidDate($to) ||
            $from > $to
        ) {
            throw new \InvalidArgumentException(
                (string) __('Invalid historical date range.')
            );
        }
    }

    /**
     * Check whether a date matches the Y-m-d format.
     *
     * @param string $date
     * @return bool
     */
    private function isValidDate(string $date): bool
    {
        $parsedDate = \DateTimeImmutable::createFromFormat(
            '!Y-m-d',
            $date
        );

        return $parsedDate !== false
            && $parsedDate->format('Y-m-d') === $date;
    }

    /**
     * Prepare a JSON error response.
     *
     * @param Json $result
     * @param string $message
     * @param int $statusCode
     * @return Json
     */
    private function setErrorResponse(
        Json $result,
        string $message,
        int $statusCode
    ): Json {
        return $result->setHttpResponseCode($statusCode)->setData([
            'success' => false,
            'message' => $message
        ]);
    }
}
