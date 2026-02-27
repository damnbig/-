import React from 'react';
import { ChevronRight } from './Icons';

interface StudioDocProps {
  onBack: () => void;
}

export const StudioDoc: React.FC<StudioDocProps> = ({ onBack }) => {
  return (
    <div className="h-full w-full overflow-y-auto bg-white/50 backdrop-blur-xl pb-24 md:pb-0">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors md:hidden"
        >
          <span className="rotate-180 inline-block"><ChevronRight size={20} /></span>
          <span className="text-sm font-medium">返回</span>
        </button>

        <article className="prose prose-slate prose-lg max-w-none">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">
            觉物造工作室文档
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-12 font-mono">
             <span>2026 Strategy</span>
             <span>•</span>
             <span>Internal Memo</span>
          </div>

          <div className="space-y-12 text-gray-700 leading-relaxed">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold">1</span>
                分析现在的局面
              </h2>
              <p className="mb-6">
                年前大家开了个小会，讲了些真话，也摆了很多问题：负责跑市场的人说，地推难，效率低，要想办法搞新的销售策略；负责抓技术的人说，只要东西做得好，就不愁没人要；负责搞策划的人说，现在内部太乱，没有规矩，效率出不来。
              </p>
              <p className="mb-6 font-medium text-gray-900 bg-gray-100 p-4 rounded-xl border-l-4 border-gray-900">
                这三种意见对不对？都对。但这只是看到了局部，没有看到全局。
              </p>
              <p className="mb-6">
                我们这个团队目前最大的问题是什么？还是大家对工作室能创造的价值，抱有很大期望，但我们的投入又是非常有限。
              </p>
              <p className="mb-6">
                客观现实是：工作室这边的项目研发目前并不是大家100%投入精力的唯一主业。李叔有自己一摊子成熟的传统生意要管，一年里60-80%的精力放在那边；李能逸作为技术支持，也有50-60%的精力需要协助李叔处理传统生意的事务。可见团队绝大部分的时间、精力和资源，其实都还在原有的老生意里。这很现实，毕竟老生意是现在的基本盘。但最大的问题就出在这里：<span className="text-gray-900 font-semibold">我们不能用“业余的投入”，去要求“专业的产出”。</span>
              </p>
              <p className="mb-6">
                宏观上，团队还没有完全明确的长远意图，有时候什么都想试一下；微观上，还没有拟定出具体的纪律，想起来了抓一把，老生意忙起来了就只能把工作室的事先放一边。
              </p>
              <p className="mb-6">
                三个人，用着切分出来的部分时间和资源，却希望能在这个新工作室（新团队）里创造出惊人的利润和奇迹。这就是搞策划的人说的“核心团队没有凝聚力，人太散了”的根源。大家投入的是兼职的精力，想要的是全职甚至超常的回报。在没有明确战略和基本纪律的情况下，这种“散”导致的工作低效是必然的。
              </p>
              <p className="mb-6">
                低效率必然带来的就是成本的增加，降本增效，增加效率就是降低成本，在工作室发展起来之前，对于工作室来说，花一个月就做出来一个项目，和花半年才磨出来一个项目，显然是不同的结局，拖只会把团队拖垮。那能不能只花更少的时间就能做出来项目呢？答案是能，有没有办法解决低效率的情况？答案是有，就是在2026年，大家把更多精力和资源抽出来，投入到这个小团队来，把这个大家期望中的可能创造巨大“价值”的新团队真正的搭建起来。
              </p>
              <p className="mb-6">
                搭建起来，意味着要做什么？首先要明确工作室的长远意图，这关系到团队存在的基本意义问题：既然老生意每年也能接上百万的单子，能创造价值，为什么还要单独分出精力和资源来搞这个新团队？是不是多此一举？
              </p>
              <p className="mb-6">
                答案其实大家心里都清楚，老生意的模式已经看到了天花板，甚至藏着巨大的风险，耕耘20多年的宗教雕塑和工程，一年接个一百多万的单子听起来不少，但干得太重、太累、周期太长。25年的活拖到26年3月还没交工结算，这就是现实。更不用说工地上亲力亲为，还隐藏着巨大的人身安全风险和用工风险，只要出一次意外，一年的辛苦可能就白搭。遇到大环境的波动（比如前几年的疫情），工程直接停摆，甚至要靠做其它生意来维持。
              </p>
              <p className="mb-6">
                这种高风险、重体力、慢周期的“工程模式”，抗风险能力太差，赚钱太难。特别是在面对现实压力的时候，老生意模式这种缓慢的回血速度是让人焦虑的。
              </p>
              <div className="bg-indigo-50 p-6 rounded-2xl mb-8">
                <p className="text-indigo-900 font-medium mb-0">
                  所以，我认为这个新团队存在的唯一意义，也是李叔当初想破局的初衷：我们要把赚钱的模式，从“在工地上苦哈哈地做单件工程”，升级成“在工作室里搞研发、做标准化的产品去批量卖”。我们要靠AI设计、靠知识产权、靠批量的产品矩阵来赚钱，而不是纯靠时间和肉身去扛风险。
                </p>
              </div>
              <p className="mb-6">
                如果不回答、不认清这个根本意义，我们的团队就站不住脚，做这件事就是多此一举。如果新工作室最后还是做成了原来那个“小作坊”，那大家投入在这里的时间就是巨大的浪费。
              </p>
              <p className="mb-6">
                其二就是在上述情况基本达成共识之后，我们需要在后续会议上，白纸黑字地敲定以下几项基本纪律和讨论出后续如何开展工作，每个人负责的领域和工作任务。具体怎么定，大家一起商议：
              </p>
              <ul className="list-disc pl-6 space-y-3 mb-6 marker:text-gray-400">
                <li>
                  <strong className="text-gray-900">时间安排：</strong> 老生意是基本盘，不能丢，兼职可以，但必须为新工作室划定“不可侵犯”的时间比例（比如每周固定的工作日或时长），老生意的突发事件不能随意穿插打断。
                </li>
                <li>
                  <strong className="text-gray-900">工作任务边界：</strong> 核心团队的价值在脑力与核心技术。我们需要讨论出一个明确的节点比如：童儿项目跑到什么阶段，核心成员（特别是李能逸和我）必须全面退出修模、打磨等手工环节？聘请工人的触发条件和资金来源是什么？团队核心成员必须逐步退出修模、打磨等基础体力劳动。
                </li>
                <li>
                  <strong className="text-gray-900">奖罚与交付：</strong> 设计、建模、打样、推销，每一个环节都必须有明确的交付时间，不能无限期拖延。如果明确了分工，到了节点交不出东西（比如设计图出了，但模型迟迟没打印；或者模型好了，但迟迟没有推进销售），我们内部的问责机制是什么？如果工作效率高，提前完成，奖励机制又是什么？
                </li>
              </ul>
              <p className="mb-6">
                其三，值得肯定的是，不利情况在2025年底已经发生了改善，团队要维系下去需要做出些成绩，所以大家在年前的心态是向好的，并且达成了一个非常重要、也非常正确的共识：<span className="text-gray-900 font-semibold">咱们要先拿相对简单的“童儿”项目来练手。</span>
              </p>
              <p className="mb-6">
                目的很明确，就是为了从0到1，把“设计—AI建模—人工修模—3D打印—制作硅胶模具—水泥翻模”这一整套新流程彻底跑通。通过这个项目，大家先见到回头钱，同时积累实战经验和信心，等队伍磨合好了，技术取得了突破，再逐步过渡到像飞天灯具那样的大型复杂精品上。这个战略路线是对的，是符合客观规律的，这是我们在向好转变的苗头。
              </p>
              <p className="mb-6">
                之所以有底气制定这样的战略，是从技术层面上来说，过去一两年，哪怕老生意现金流再紧张，厂里也置办了雕刻机、3D打印机，更重要的是，26年有一个很重大的突破，就是AI辅助设计。过去我们有什么想法，比如莲花灯具、飞天、童儿、大型塑像、纹饰物件这些，要设计和建模，只有靠懂美术的人来画，或者是在网上找参考图去建模，这样都是很吃力的，我们要靠买别人的模型过日子，缺乏原创能力，很难把脑子里的想法转化为模型进行生产。在那种情况下，工作室没有办法构建自己的产品图册和原创产品序列，也就很难把生意做大。现在，任何复杂的想法（小中大型塑像），我们都可以自己用AI设计、建模再生产。AI技术至少帮我们省去了70%左右的设计和建模时间。这就意味着，我们从“靠手艺吃饭”的作坊，升级成了拥有“自主研发和产品化能力”的团队。
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold">2</span>
                讨论2026年的行动方向
              </h2>
              <p className="mb-6">
                2026年我们要怎么干？如果大家的共识是“童儿是过渡，飞天（精品）是目标”，那我们的步子就要迈对。根据我们手里现有的项目（童儿、飞天），可以分出两条路来走。
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">第一条路：童儿系列（现金流业务）</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    核心就是标准化。前期大家亲历亲为，是为了解决技术问题，把路蹚平，现在基础难题解决了，下一步就是定好规矩和流程，接受它在走量时合理的瑕疵，彻底交给工人师傅去批量执行，核心团队绝不能再长年累月耗在这个体力活上。
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2">
                      <span className="font-semibold text-gray-900 shrink-0">战略定位:</span>
                      <span className="text-gray-600">养活团队，提供稳定的现金流，覆盖基本运营成本。</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold text-gray-900 shrink-0">年度目标:</span>
                      <span className="text-gray-600">量产（1000+目标）。</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="font-semibold text-gray-900 mb-2">执行策略:</p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-600">
                        <li><strong>生产端（SOP化）:</strong> 2026年Q1内，核心人员退出重复性体力劳动，工作SOP化，交由学徒或工人。团队只负责质检（QC）。</li>
                        <li><strong>销售端（渠道化）:</strong> 保持线下推广，重心转向寻找“批发商”或“线上分销渠道”，利用数字资料尝试批量预售。</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-lg">
                  <h3 className="text-lg font-bold text-white mb-4">第二条路：品牌旗舰业务</h3>
                  <p className="text-sm text-gray-300 mb-4">
                    这才是我们新团队真正要主攻的高地。李叔之前提出做飞天项目，这种万元级定价的产品，可能利润空间更大，这种项目可以真正树立我们工作室的招牌，“东西好就不愁卖”的思路，应该用在旗舰项目上。
                  </p>
                  <p className="text-sm text-gray-300">
                    要把这个高价值项目做成，核心团队必须从童儿的流水线里解放出来。做策划的把概念图和AI模型做到极致，做技术的把复杂的结构和细节难点啃下来，跑市场的拿着真正的好东西去对接大客户。好钢必须用在刀刃上。
                  </p>
                  <div className="mt-6 p-4 bg-white/10 rounded-xl">
                    <p className="text-xs text-gray-400 font-mono mb-2">待议事项</p>
                    <p className="text-sm font-medium">怎么来做？怎么定价？怎么安排时间？谁来牵头启动？</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold">3</span>
                写在最后
              </h2>
              <p className="mb-6">
                以上仅是我基于工作室现状做出的初步梳理和不完善的规划建议。
              </p>
              <p>
                关于具体各项事务怎么定、这份意见草案是否存在问题、大家的意见修改补充、以及飞天项目到底该投入多大精力等事宜，希望大家看后，我们能安排时间，进行一次补充和最终定调。在会上讨论确定了规矩，2026年我们就严格照着执行。
              </p>
            </section>
          </div>
          
          <div className="mt-20 pt-10 border-t border-gray-200 text-center text-gray-400 text-sm">
            Jue Wu Zao Studio • 2026 Documentation
          </div>
        </article>
      </div>
    </div>
  );
};
