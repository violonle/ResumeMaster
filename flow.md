graph TD
    %% 定义样式
    classDef userNode fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef aiNode fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef shopNode fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;
    classDef payNode fill:#fce4ec,stroke:#880e4f,stroke-width:2px;
    classDef extNode fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,stroke-dasharray: 5 5;

    subgraph User_Side [用户端 App/小程序]
        Start((开始/登录)):::userNode --> UserHome[首页/工作台]
        UserHome --> Profile[个人中心<br/>用户画像/等级/积分]
        
        %% 核心路径A：AI诊断
        UserHome --> AIDetect[AI 舌苔检测入口]:::aiNode
        AIDetect --> UploadImg[上传/拍摄舌苔]
        UploadImg --> AI_Engine{AI 分析引擎}:::aiNode
        AI_Engine -->|分析完成| Report[生成健康报告<br/>体质/风险预警]
        Report --> Archive[存入健康档案]
        Report --> Recommend[智能推荐<br/>商品/服务/医生]
        
        %% 核心路径B：商城交易
        UserHome --> MallHome[健康商城]:::shopNode
        Recommend --> ProductDetail[商品详情页]:::shopNode
        MallHome --> ProductDetail
        ProductDetail -->|区分等级价格| Cart[购物车/立即购买]
        Cart --> OrderConfirm[订单确认<br/>选择优惠券/积分抵扣]
        
        %% 核心路径C：权益与服务
        UserHome --> RightsCenter[权益中心]
        RightsCenter --> BuyVIP[购买/升级 VIP]
        
        %% 路径D：医疗服务
        Recommend --> HospitalLink[互联网医院对接]:::extNode
        UserHome --> HospitalLink
    end

    subgraph Payment_System [支付与结算]
        OrderConfirm --> PayGate{支付网关}:::payNode
        BuyVIP --> PayGate
        PayGate -->|调用SDK| Xiaoxiang[潇湘支付]:::payNode
        Xiaoxiang -->|回调成功| PaySuccess[支付成功]
        PaySuccess --> AddPoints[增加用户积分]
        PaySuccess --> OrderStatus[更新订单状态: 待发货]
    end

    subgraph Fulfillment [履约与交付]
        OrderStatus -->|实物| Logistics[物流发货系统]
        OrderStatus -->|虚拟权益| ActiveRights[自动开通权益/VIP]
        Logistics --> UserReceipt[用户收货]
        UserReceipt --> Review[评价与反馈]
    end

    %% 数据流向
    AI_Engine -.->|脱敏数据| ModelTrain[后台: AI模型优化]
    PaySuccess -.->|交易数据| DataBoard[后台: 财务大屏]