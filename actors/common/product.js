import { PutObjectCommand } from "@aws-sdk/client-s3";
import { CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { shopOrigin, itemSlug } from "@hlidac-shopu/lib/shops.mjs";
import { cleanPriceText } from "@hlidac-shopu/lib/parse.mjs";
import { Dataset } from "apify";

/** @typedef { import("@aws-sdk/client-s3").S3Client } S3Client */
/** @typedef { import("@aws-sdk/client-cloudfront").CloudFrontClient } CloudFrontClient */
/** @typedef { import("schema-dts").Product} Product */
/** @typedef { import("./stats").Stats} Stats */

const isDisabled = process.env.DISABLE_LINKED_DATA || process.env.TEST;

/**
 *
 * @param detail
 * @param priceCurrency
 * @param additionalData
 * @returns {Product}
 */
export function toProduct(detail, { priceCurrency, ...additionalData } = {}) {
  return Object.assign(
    {
      "@scope": "https://schema.org/",
      "@type": "Product",
      sku: detail.itemId,
      name: detail.itemName,
      url: detail.itemUrl,
      image: detail.img,
      category: detail.category,
      offers: {
        "@type": "Offer",
        availability: `https://schema.org/${
          detail.inStock ? "InStock" : "OutOfStock"
        }`,
        price: detail.currentPrice,
        priceCurrency: detail.currency
          ? currencyToISO4217(detail.currency)
          : priceCurrency
      }
    },
    additionalData
  );
}

/**
 * @param {S3Client} s3
 * @param {string} shop
 * @param {string} fileName
 * @param {string} ext
 * @param {*} data
 * @returns {Promise<void>}
 */
async function uploadToS3(s3, shop, fileName, ext, data) {
  if (isDisabled) return;
  await s3.send(
    new PutObjectCommand({
      Bucket: "data.hlidacshopu.cz",
      Key: `products/${shop}/${fileName}.${ext}`,
      ContentType: `application/${ext}`,
      Body: JSON.stringify(data)
    })
  );
}

/**
 * @param {S3Client} s3
 * @param {*} item
 * @param {*} extraData
 */
export async function uploadToS3v2(s3, item, extraData = {}) {
  if (!item.itemUrl) {
    throw new Error("Item missing attribute itemUrl");
  }
  return uploadToS3(
    s3,
    shopOrigin(item.itemUrl),
    itemSlug(item.itemUrl),
    "jsonld",
    toProduct(item, extraData)
  );
}

/**
 * Save unique products to dataset
 * @param {{products: object[], stats: Stats, processedIds: Object<string, Object>}} options
 * @returns {Promise<number>}
 */
export async function saveUniqProducts({ products, stats, processedIds }) {
  const newProducts = [];
  for (const product of products) {
    if (processedIds[product.itemId] !== product.currentPrice) {
      if (processedIds[product.itemId]) {
        stats.inc("itemsChanged");
      }
      processedIds[product.itemId] = product.currentPrice;
      newProducts.push(product);
    } else {
      stats.inc("itemsDuplicity");
    }
  }
  await Dataset.pushData(newProducts);
  return products.length;
}

/**
 *
 * @param {CloudFrontClient} cloudfront
 * @param {string} distributionId
 * @param {string} shop
 * @returns {Promise<void>}
 */
export async function invalidateCDN(cloudfront, distributionId, shop) {
  if (isDisabled) return;
  await cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        Paths: { Items: [`/products/${shop}/*`], Quantity: 1 },
        CallerReference: new Date().getTime().toString()
      }
    })
  );
}

export function invalidateCDNv2(cloudfront, rootUrl) {
  return invalidateCDN(
    cloudfront,
    process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
    shopOrigin(rootUrl)
  );
}

export function currencyToISO4217(currency) {
  switch (currency.toLowerCase()) {
    case "kč":
      return "CZK";
    case "€":
      return "EUR";
    default:
      return currency;
  }
}

export function cleanPrice(s) {
  if (!s) return null;
  const price = cleanPriceText(s);
  if (!price) return null;
  const number = parseFloat(price);
  if (isNaN(number)) return null;
  return number;
}

export * from "@hlidac-shopu/lib/parse.mjs";
