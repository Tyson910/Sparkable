import { Any, DataSource } from 'typeorm';
import { LinkDto } from '../../../domain/models/LinkDto';
import { LinkRepository } from '../../../domain/repositories/LinkRepository';
import { LinkEntity } from '../entities/LinkEntity';

export class LinkRepositoryPG implements LinkRepository {
  private repository;

  readonly LIMIT = 20;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(LinkEntity);
  }

  async getAllLinks(
    sort?: string,
    categories?: string,
  ): Promise<[LinkDto[], number]> {
    let query: Record<string, any> = {};

    const categoriesToFilter = categories?.split(',');
    query = this.addQueryFilterByCategories(categoriesToFilter, query);

    if (sort) {
      return await this.findSortingByDate(query);
    } else {
      return await this.findSortingRandom(query);
    }
  }

  async storeLink(link: LinkDto) {
    const linkEntity = new LinkEntity();
    linkEntity.link = link.link;
    linkEntity.title = link.title;
    linkEntity.image = link.image;
    linkEntity.description = link.description;
    linkEntity.date = link.date;
    linkEntity.categories = link.categories;

    await this.repository.save(linkEntity);

    return linkEntity.toDto();
  }

  async findLink(field: string, value: string): Promise<LinkDto | undefined> {
    const link = await this.repository.findOne({
      where: { [field]: value },
      relations: ['categories'],
    });
    return link?.toDto();
  }

  private addQueryFilterByCategories(
    categoriesToFilter: string[] | undefined,
    query: Record<string, any>,
  ) {
    if (categoriesToFilter) {
      const categoriesFilter: { categories: { name: string } }[] = [];
      categoriesToFilter.forEach((category) => {
        categoriesFilter.push({ categories: { name: category } });
      });

      query.relations = { categories: true };
      query.where = categoriesFilter;
    }

    return query;
  }

  private async findSortingByDate(
    query: Record<string, any>,
  ): Promise<[LinkDto[], number]> {
    query.order = { date: 'DESC' };
    query.take = this.LIMIT;

    return await this.repository.findAndCount(query);
  }

  private async findSortingRandom(
    query: Record<string, any>,
  ): Promise<[LinkDto[], number]> {
    const isFilteringByCategories = query.relations;
    if (isFilteringByCategories) {
      //improve this in the future... poor performance with lots of data
      const result = await this.repository.findAndCount(query);
      this.shuffle(result[0]);
      result[0] = result[0].slice(0, this.LIMIT);
      return result;
    } else {
      const result = await this.repository
        .createQueryBuilder('links')
        .select()
        .orderBy('RANDOM()')
        .take(this.LIMIT)
        .getMany();
      return new Promise((resolve) => resolve([result, result.length]));
    }
  }

  private shuffle(array: any) {
    let currentIndex = array.length,
      randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  }
}
