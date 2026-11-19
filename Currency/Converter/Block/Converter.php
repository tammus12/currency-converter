<?php
/**
 * Copyright © Magento. All rights reserved.
 * See COPYING.txt for license details.
 */

declare(strict_types=1);

namespace Currency\Converter\Block;

use Magento\Framework\UrlInterface;
use Magento\Framework\View\Element\Template;

/**
 * Currency Converter storefront block.
 *
 * Provides configuration and URL information required
 * by the Currency Converter frontend template.
 */
class Converter extends Template
{
    /**
     * URL builder instance.
     *
     * @var UrlInterface
     */
    private UrlInterface $urlBuilder;

    /**
     * Converter block constructor.
     *
     * @param Template\Context $context
     * @param UrlInterface $urlBuilder
     * @param array $data
     */
    public function __construct(
        Template\Context $context,
        UrlInterface $urlBuilder,
        array $data = []
    ) {
        parent::__construct($context, $data);
        $this->urlBuilder = $urlBuilder;
    }

    /**
     * Retrieve the Currency Converter API endpoint URL.
     *
     * @return string
     */
    public function getApiUrl(): string
    {
        return $this->urlBuilder->getUrl(
            'currency-converter/api/rates',
            ['_secure' => true]
        );
    }
}
