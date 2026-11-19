<?php
/**
 * Copyright © Magento. All rights reserved.
 * See COPYING.txt for license details.
 */

declare(strict_types=1);

namespace Currency\Converter\Model;

use Magento\Framework\HTTP\Client\Curl;
use Magento\Framework\Serialize\Serializer\Json;
use RuntimeException;

/**
 * Service class for communicating with the Frankfurter Exchange Rate API.
 *
 * Provides methods to retrieve supported currencies, latest exchange rates,
 * and historical exchange rate information.
 */
class Frankfurter
{
    /**
     * Frankfurter API base URL.
     *
     * @var string
     */
    private const API_URL = 'https://api.frankfurter.dev/v2';

    /**
     * HTTP client instance.
     *
     * @var Curl
     */
    private Curl $curl;

    /**
     * JSON serializer instance.
     *
     * @var Json
     */
    private Json $json;

    /**
     * Frankfurter constructor.
     *
     * @param Curl $curl
     * @param Json $json
     */
    public function __construct(
        Curl $curl,
        Json $json
    ) {
        $this->curl = $curl;
        $this->json = $json;
    }

    /**
     * Send a GET request to the Frankfurter API.
     *
     * @param string $endpoint
     * @return array
     * @throws RuntimeException
     */
    private function request(string $endpoint): array
    {
        $this->curl->setTimeout(15);
        $this->curl->addHeader('Accept', 'application/json');

        $this->curl->get(self::API_URL . $endpoint);

        $statusCode = $this->curl->getStatus();
        $responseBody = $this->curl->getBody();

        if ($statusCode !== 200) {
            throw new RuntimeException(
                'Frankfurter API request failed. HTTP status: ' . $statusCode
            );
        }

        try {
            $responseData = $this->json->unserialize($responseBody);
        } catch (\InvalidArgumentException $exception) {
            throw new RuntimeException(
                'Unable to decode Frankfurter API response.',
                0,
                $exception
            );
        }

        if (!is_array($responseData)) {
            throw new RuntimeException(
                'Invalid response received from Frankfurter API.'
            );
        }

        return $responseData;
    }

    /**
     * Retrieve all currencies supported by Frankfurter.
     *
     * @return array
     * @throws RuntimeException
     */
    public function getCurrencies(): array
    {
        return $this->request('/currencies');
    }

    /**
     * Retrieve the latest exchange rate for a currency pair.
     *
     * @param string $base
     * @param string $quote
     * @return array
     * @throws RuntimeException
     */
    public function getLatestRate(
        string $base,
        string $quote
    ): array {
        $base = strtolower($base);
        $quote = strtolower($quote);

        $endpoint = sprintf(
            '/rate/%s/%s',
            rawurlencode($base),
            rawurlencode($quote)
        );

        return $this->request($endpoint);
    }

    /**
     * Retrieve historical exchange rates for a currency pair.
     *
     * @param string $base
     * @param string $quote
     * @param string $from
     * @param string $to
     * @return array
     * @throws RuntimeException
     */
    public function getHistoricalRates(
        string $base,
        string $quote,
        string $from,
        string $to
    ): array {
        $queryParams = [
            'from' => $from,
            'to' => $to,
            'base' => strtoupper($base),
            'quotes' => strtoupper($quote)
        ];

        $queryString = http_build_query($queryParams);

        return $this->request('/rates?' . $queryString);
    }
}
