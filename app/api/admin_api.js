import * as db from '../services/schema.js';

// get products added at ( n ) hours ago
export const productsDataInPastHours = async (hoursAgo) => {
    try {
        // confirming hoursAgo is a number
        if (isNaN(Number(hoursAgo)) || Number(hoursAgo || !hoursAgo) < 1) throw 'Invalid query parameters';

        return await db.products.aggregate([
            {
                $match: {
                    'creationTime': {
                        $gte: (new Date(new Date() - 1 * 60 * 60 * hoursAgo * 1000))
                    }
                }
            },
            {
                $sort: {
                    'creationTime': -1
                }
            }
        ]);
    } catch (error) {
        throw 'Error fetching products data form db';
    };
};
// get orders at ( n ) hours ago
export const ordersDataInPastHours = async (hoursAgo) => {
    try {

        // confirming hoursAgo is a number
        if (isNaN(Number(hoursAgo)) || Number(hoursAgo || !hoursAgo) < 1) reject('Invalid query parameters');

        // getting data form db and resolving...
        return await db.orders.aggregate([
            {
                $unwind: '$orders'
            },
            {
                $match: {
                    'orders.dateOFOrder': {
                        $gte: (new Date(new Date() - 1 * 60 * 60 * hoursAgo * 1000))
                    }
                }
            },
            {
                $sort: {
                    'orders.dateOFOrder': 1
                }
            }
        ]);

    } catch (error) {
        throw 'Error fetchign orders data form db';
    };
};
// get category usage at ( n ) hours ago
export const categoryUsageInPastHours = async (hoursAgo) => {
    try {

        const output = {};
        const data = await db.category.aggregate([
            {
                $lookup: {
                    from: 'products',
                    let: { category: '$category' },
                    pipeline: [
                        {
                            $match: {
                                'category': '$$category',
                            }
                        }
                    ],
                    as: 'products'
                }
            }
        ]);

        return data;
    } catch (error) {
        throw 'Error while fetching category data form db';
    };
};
// total products net worth of added hours ago
export const totalProductNetWorth = async (hoursAgo) => {
    try {
        const data = await db.products.aggregate([
            {
                $addFields: {
                    netTotal: {
                        $multiply: [
                            { $subtract: ['$price', '$offer'] },
                            '$stock'
                        ]
                    },
                    total: { $subtract: ['$price', '$offer'] }
                }
            },
            {
                $group: {
                    _id: 'netTotalOfAll',
                    AllProductsNetTotal: { $sum: '$netTotal' },
                    products: { $addToSet: '$$ROOT' }
                }
            },
            { $unwind: '$products' },
            { $addFields: { 'products.AllProductsNetTotal': '$AllProductsNetTotal' } },
            {
                $replaceRoot: {
                    newRoot: '$products'
                }
            },
            {
                $sort: {
                    creationTime: -1
                }
            },
            {
                $match: {
                    'lastPurchased': {
                        $gte: (new Date(new Date() - 1 * 60 * 60 * hoursAgo * 1000))
                    }
                }
            }
        ]);
        return data;
    } catch (error) {
        throw 'Error fetching product data form server';
    }
};
// reutrn total orders count only
export const salesInYear_count = async (year) => {
    try {
        return await salesInYear(year, true);
    } catch (error) {
        throw error;
    };
};
// reutrn total orders count and products 
export const salesInYear = async (year, noData) => {
    try {

        // validating year 
        if (isNaN(Number(year)) || !Number(year) || (year + "").length != 4) throw 'Invalid year';

        try {
            const projectQuery = {};

            projectQuery._id = 0;
            projectQuery.length = '$length';
            projectQuery.month = '$_id';

            if (!noData) projectQuery.orders = "$orders";

            // fetching data
            const dataFromDb = await db.orders.aggregate([
                {
                    $match: {
                        'orders.dateOFOrder': {
                            $gte: new Date(`${year}-01-01`),
                            $lte: new Date(`${year}-12-31`)
                        }
                    },
                },
                {
                    $unwind: '$orders'
                },
                {
                    $group: {
                        _id: { $month: "$orders.dateOFOrder" },
                        length: { $sum: 1 },
                        orders: {
                            $addToSet: '$orders'
                        }
                    }
                },
                {
                    $project: projectQuery
                },
                { $sort: { month: 1 } }
            ]);

            // resolving output data
            return dataFromDb;
        } catch (error) {
            throw 'Error fetching sales data form db';
        };

    } catch (error) {
        throw error;
    };
};
// reutrn total views in today for each hour
export const userViewsInDay = async () => {
    try {

        const day_start = new Date(new Date().setHours(0, 0, 0, 1));

        const dataFromDb = await db.analytics.aggregate([
            { $unwind: '$data' },
            {
                $match: {
                    title: 'user_page_request',
                    data: {
                        $gte: day_start
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $hour: {
                            date: '$data',
                            timezone: '+05:30'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    count: '$count',
                    _id: 0,
                    hour: '$_id'
                }
            }
        ]);

        return dataFromDb;

    } catch (error) {
        throw 'Error fetching data from db';
    };
};
// reutrn total data of each pages requests
export const getRequestByPages = async () => {
    try {
        const day_start = new Date(new Date().setHours(0, 0, 0, 1));
        const data = await db.analytics.aggregate([
            {
                $facet: {
                    home: [
                        { $match: { title: 'user_home_GET' }, },
                        { $unwind: '$data' },
                        { $match: { data: { $gte: day_start } } },
                        { $group: { _id: { $hour: { date: '$data', timezone: '+05:30' } }, count: { $sum: 1 } } },
                        { $project: { count: '$count', _id: 0, hour: '$_id' } }
                    ],
                    shop: [
                        { $match: { title: 'user_shop_GET' }, },
                        { $unwind: '$data' },
                        { $match: { data: { $gte: day_start } } },
                        { $group: { _id: { $hour: { date: '$data', timezone: '+05:30' } }, count: { $sum: 1 } } },
                        { $project: { count: '$count', _id: 0, hour: '$_id' } }
                    ],
                    product: [
                        { $match: { title: 'user_product_GET' }, },
                        { $unwind: '$data' },
                        { $match: { data: { $gte: day_start } } },
                        { $group: { _id: { $hour: { date: '$data', timezone: '+05:30' } }, count: { $sum: 1 } } },
                        { $project: { count: '$count', _id: 0, hour: '$_id' } }
                    ],
                    cart: [
                        { $match: { title: 'user_cart_GET' }, },
                        { $unwind: '$data' },
                        { $match: { data: { $gte: day_start } } },
                        { $group: { _id: { $hour: { date: '$data', timezone: '+05:30' } }, count: { $sum: 1 } } },
                        { $project: { count: '$count', _id: 0, hour: '$_id' } }
                    ],
                    wishlist: [
                        { $match: { title: 'user_wishlist_GET' }, },
                        { $unwind: '$data' },
                        { $match: { data: { $gte: day_start } } },
                        { $group: { _id: { $hour: { date: '$data', timezone: '+05:30' } }, count: { $sum: 1 } } },
                        { $project: { count: '$count', _id: 0, hour: '$_id' } }
                    ],
                    dashboard: [
                        { $match: { title: 'user_dashboard_GET' }, },
                        { $unwind: '$data' },
                        { $match: { data: { $gte: day_start } } },
                        { $group: { _id: { $hour: { date: '$data', timezone: '+05:30' } }, count: { $sum: 1 } } },
                        { $project: { count: '$count', _id: 0, hour: '$_id' } }
                    ],
                    checkout: [
                        { $match: { title: 'user_checkout_GET' }, },
                        { $unwind: '$data' },
                        { $match: { data: { $gte: day_start } } },
                        { $group: { _id: { $hour: { date: '$data', timezone: '+05:30' } }, count: { $sum: 1 } } },
                        { $project: { count: '$count', _id: 0, hour: '$_id' } }
                    ]
                }
            }
        ]);
        return data[0];
    } catch (error) {
        throw error;
    };
};

// 
export const getProductInPages = async (pages) => {
    // validating request values
    if (isNaN(Number(pages)) || Number(pages) < 1 || !pages) throw ('Invalid query parameters');

    try {
        // number of products to list on each page
        const listLenght = 5;
        const outputData = {};

        outputData.length = listLenght;

        const countFromDb = await db.products.aggregate([{ $group: { _id: 'totalLenght', sum: { $sum: 1 } } }]);
        outputData.totalCount = countFromDb[0].sum;

        // getting and resolvind data
        outputData.data = await db.products.aggregate([
            { $sort: { 'creationTime': 1 } },
            { $skip: ((pages - 1) * listLenght) },
            { $limit: listLenght }
        ]);

        return outputData;

    } catch (error) {
        throw 'Error while fetching data from db';
    };
};

async function test() {
    try {
        const data = await getRequestByPages();
        console.log("data => ", data);
    } catch (error) {
        console.log("error =>", error);
    }
}
// test()